import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SessionIdentity } from "./auth";
import type {
  AdvisingCase,
  Intervention,
  CaseAssignee,
  CaseWorkspace,
  UnifiedStudentRecord,
  WorkflowEvent,
} from "@/shared/types";
import { canAccessStudent, canFollowUp } from "./access";
import { audit, execute, first, masters, rows, transaction } from "./store";
import { WorkflowError, requireWorkflowRole } from "./workflow";

const roles = ["REGISTRAR", "DEAN", "ACADEMIC_ADVISOR"] as const;
export function normalizeCase(
  entry: Intervention & Partial<AdvisingCase>,
): AdvisingCase {
  return {
    ...entry,
    reason:
      entry.reason ||
      "Academic support referral — review and assign a staff member",
    priority: entry.priority || "Normal",
    updatedAt: entry.updatedAt || entry.createdAt,
    notes: entry.notes || [],
    history: entry.history || [],
  };
}
export function canReadCase(
  s: Pick<SessionIdentity, "role" | "userId">,
  c: Intervention,
) {
  return (
    canFollowUp(s.role) &&
    (s.role !== "ACADEMIC_ADVISOR" ||
      !c.assigneeId ||
      c.assigneeId === s.userId ||
      c.createdById === s.userId)
  );
}
const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Enter a real due date.",
  )
  .nullable();
export const caseCommand = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      studentId: z.string().max(60),
      assigneeId: z.string().max(100),
      reason: z.string().trim().min(5).max(1000),
      priority: z.enum(["Normal", "High"]),
      dueDate,
    })
    .strict(),
  z
    .object({
      type: z.literal("assign"),
      id: z.string().max(100),
      assigneeId: z.string().max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("update"),
      id: z.string().max(100),
      status: z.enum(["Open", "In progress", "Resolved"]),
      priority: z.enum(["Normal", "High"]),
      dueDate,
      note: z.string().trim().max(4000),
      outcome: z.string().trim().max(1000),
    })
    .strict(),
]);
async function assignees(): Promise<CaseAssignee[]> {
  return (
    await rows<{
      id: string;
      display_name: string;
      role: CaseAssignee["role"];
      department: string | null;
    }>(
      "SELECT id,display_name,role,department FROM users WHERE active=1 AND role IN ('REGISTRAR','DEAN','ACADEMIC_ADVISOR') ORDER BY display_name",
    )
  ).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    role: r.role,
    ...(r.department ? { department: r.department } : {}),
  }));
}
async function permittedAssignee(
  s: SessionIdentity,
  id: string,
  student: UnifiedStudentRecord,
) {
  const target = (await assignees()).find((a) => a.id === id);
  if (
    !target ||
    (target.role === "DEAN" && target.department !== student.department) ||
    (s.role === "ACADEMIC_ADVISOR" && target.id !== s.userId)
  )
    throw new WorkflowError(
      "Choose an active permitted staff member; advisors can assign cases to themselves only.",
      400,
    );
  return target;
}
export async function caseWorkspace(
  s: SessionIdentity,
): Promise<CaseWorkspace> {
  await requireWorkflowRole(s, roles);
  const students = (await masters()).filter((student) =>
    canAccessStudent(s.role, s, student),
  );
  const permitted = new Set(students.map((st) => st.studentId));
  const cases = (
    await rows<{ payload: string }>("SELECT payload FROM interventions")
  )
    .map((r) => normalizeCase(JSON.parse(r.payload)))
    .filter((c) => permitted.has(c.studentId) && canReadCase(s, c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const staff = (await assignees()).filter((a) =>
    s.role === "ACADEMIC_ADVISOR"
      ? a.id === s.userId
      : s.role !== "DEAN" || a.role !== "DEAN" || a.department === s.department,
  );
  return {
    cases,
    students: students.map(({ studentId, fullName, department }) => ({
      studentId,
      fullName,
      department,
    })),
    assignees: staff,
    currentUserId: s.userId!,
  };
}
export async function manageCase(s: SessionIdentity, input: unknown) {
  await requireWorkflowRole(s, roles);
  const cmd = caseCommand.parse(input);
  return transaction(async () => {
    await requireWorkflowRole(s, roles);
    let current: AdvisingCase | undefined;
    if (cmd.type !== "create") {
      const row = await first<{ payload: string }>(
        "SELECT payload FROM interventions WHERE payload::jsonb->>'id'=?",
        cmd.id,
      );
      if (row) current = normalizeCase(JSON.parse(row.payload));
      if (!current || !canReadCase(s, current))
        throw new WorkflowError("Case unavailable to this account.", 404);
    }
    const [student] = await masters(
      cmd.type === "create" ? cmd.studentId : current!.studentId,
    );
    if (!student || !canAccessStudent(s.role, s, student))
      throw new WorkflowError("Student unavailable to this account.", 404);
    const at = new Date().toISOString();
    const event = (text: string): WorkflowEvent => ({
      id: randomUUID(),
      at,
      actor: s.displayName || s.role,
      text,
    });
    let action: "CASE_CREATED" | "CASE_UPDATED" | "CASE_ASSIGNED" =
      "CASE_UPDATED";
    let c: AdvisingCase;
    if (cmd.type === "create") {
      if (
        await first(
          "SELECT 1 FROM interventions WHERE student_id=?",
          student.studentId,
        )
      )
        throw new WorkflowError(
          "This student already has a support case. Open or reopen the existing case to preserve its history.",
          409,
        );
      const assigned = await permittedAssignee(s, cmd.assigneeId, student);
      c = {
        id: randomUUID(),
        studentId: student.studentId,
        advisorName: assigned.displayName,
        assigneeId: assigned.id,
        createdById: s.userId,
        createdAt: at,
        updatedAt: at,
        status: "Open",
        reason: cmd.reason,
        priority: cmd.priority,
        ...(cmd.dueDate ? { dueDate: cmd.dueDate } : {}),
        notes: [],
        history: [
          event(`Case opened and assigned to ${assigned.displayName}.`),
        ],
      };
      action = "CASE_CREATED";
    } else {
      c = current!;
      if (cmd.type === "assign") {
        if (
          s.role === "ACADEMIC_ADVISOR" &&
          c.assigneeId &&
          c.assigneeId !== s.userId
        )
          throw new WorkflowError(
            "Only the assigned advisor or school leadership can change this case.",
          );
        const assigned = await permittedAssignee(s, cmd.assigneeId, student);
        c.assigneeId = assigned.id;
        c.advisorName = assigned.displayName;
        c.history.push(event(`Assigned to ${assigned.displayName}.`));
        action = "CASE_ASSIGNED";
      } else {
        if (s.role === "ACADEMIC_ADVISOR" && c.assigneeId !== s.userId)
          throw new WorkflowError(
            "Assign this case to yourself before recording follow-up.",
          );
        if (!c.assigneeId)
          throw new WorkflowError(
            "Assign an active staff member before recording follow-up.",
            400,
          );
        await permittedAssignee(s, c.assigneeId, student);
        if (cmd.status === "Resolved" && cmd.outcome.length < 5)
          throw new WorkflowError(
            "Record an outcome of at least five characters before resolving the case.",
            400,
          );
        if (
          c.status === "Resolved" &&
          cmd.status !== "Resolved" &&
          cmd.note.length < 5
        )
          throw new WorkflowError(
            "Explain why you are reopening the case in a follow-up note.",
            400,
          );
        if (cmd.note) c.notes.push(event(cmd.note));
        c.history.push(
          event(
            `Status ${c.status} → ${cmd.status}; priority ${cmd.priority}; due ${cmd.dueDate || "not set"}.${cmd.status === "Resolved" ? ` Outcome: ${cmd.outcome}` : ""}`,
          ),
        );
        c.status = cmd.status;
        c.priority = cmd.priority;
        c.dueDate = cmd.dueDate || undefined;
        c.outcome = cmd.status === "Resolved" ? cmd.outcome : undefined;
      }
      c.updatedAt = at;
    }
    await execute(
      "INSERT INTO interventions(student_id,payload) VALUES(?,?) ON CONFLICT(student_id) DO UPDATE SET payload=excluded.payload",
      c.studentId,
      JSON.stringify(c),
    );
    await audit(
      s.role,
      action,
      c.id,
      `${action.replaceAll("_", " ").toLowerCase()} for ${c.studentId}; status ${c.status}. Staff notes withheld from student responses.`,
      "ALLOWED",
      s,
    );
    return cmd.type === "create"
      ? "Support case created and assigned."
      : cmd.type === "assign"
        ? "Case assignment updated."
        : "Case saved. Its activity history is preserved.";
  });
}
