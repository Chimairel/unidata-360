import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SessionIdentity } from "./auth";
import type { Department } from "@/shared/school";
import type {
  RegistrationWorkspace,
  StudentAccessRequest,
} from "@/shared/registration";
import { audit, execute, first, masters, rows, transaction } from "./store";
import { requireWorkflowRole, WorkflowError } from "./workflow";
import { sendRegistrationDecisionEmail } from "./email";

interface RequestRow {
  id: string;
  student_id: string;
  email: string;
  display_name: string;
  department: Department;
  password_hash: string | null;
  created_at: string;
  email_verified_at: string;
  status: StudentAccessRequest["status"];
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
}
export const studentRequestDecision = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(1000).default(""),
  })
  .strict()
  .refine((v) => v.decision !== "reject" || v.note.length >= 5, {
    message: "Add a reason for rejection (at least 5 characters).",
  });

export async function registrationWorkspace(
  s: SessionIdentity,
): Promise<RegistrationWorkspace> {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const requests = await rows<
    Omit<RequestRow, "password_hash"> & { has_record: boolean }
  >(
    "SELECT r.id,r.student_id,r.email,r.display_name,r.department,r.created_at,r.email_verified_at,r.status,r.reviewed_at,r.reviewed_by,r.review_note,EXISTS(SELECT 1 FROM master m WHERE lower(m.id)=lower(r.student_id)) AS has_record FROM student_access_requests r ORDER BY r.created_at DESC",
  );
  return {
    requests: requests.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      email: r.email,
      fullName: r.display_name,
      department: r.department,
      createdAt: r.created_at,
      verifiedAt: r.email_verified_at,
      status: r.status,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      reviewNote: r.review_note,
      hasSchoolRecord: r.has_record,
    })),
  };
}
export async function reviewStudentRequest(
  s: SessionIdentity,
  input: unknown,
): Promise<RegistrationWorkspace> {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const cmd = studentRequestDecision.parse(input);
  const email = await transaction(async () => {
    await requireWorkflowRole(s, ["REGISTRAR"]);
    const request = await first<RequestRow>(
      "SELECT * FROM student_access_requests WHERE id=?",
      cmd.id,
    );
    if (!request) throw new WorkflowError("Request not found.", 404);
    if (request.status !== "Pending")
      throw new WorkflowError("This request has already been reviewed.", 409);
    if (!request.email_verified_at || !request.password_hash)
      throw new WorkflowError(
        "Email verification is required before approval.",
        409,
      );
    let userId: string | null = null;
    if (cmd.decision === "approve") {
      if (
        await first(
          "SELECT 1 FROM users WHERE email=? OR lower(student_id)=lower(?)",
          request.email,
          request.student_id,
        )
      )
        throw new WorkflowError(
          "An account already uses this email or school ID.",
          409,
        );
      const canonical = await first<{ id: string }>(
        "SELECT id FROM master WHERE lower(id)=lower(?)",
        request.student_id,
      );
      const [student] = canonical ? await masters(canonical.id) : [];
      if (
        student &&
        (student.email.trim().toLowerCase() !== request.email ||
          student.department !== request.department)
      )
        throw new WorkflowError(
          "The request differs from SIS. Confirm the email and department before approval.",
          409,
        );
      if (
        !student &&
        (await first(
          "SELECT 1 FROM sources WHERE feed='SIS' AND lower(record_key)=lower(?)",
          request.student_id,
        ))
      )
        throw new WorkflowError(
          "Run ETL to publish the imported SIS record before approval.",
          409,
        );
      userId = randomUUID();
      await execute(
        "INSERT INTO users(id,email,display_name,password_hash,role,student_id,department) VALUES(?,?,?,?,'STUDENT',?,?)",
        userId,
        request.email,
        student?.fullName || request.display_name,
        request.password_hash,
        student?.studentId || request.student_id,
        request.department,
      );
      await execute(
        "DELETE FROM login_attempts WHERE email=? OR email=?",
        request.email,
        request.student_id.toLowerCase(),
      );
    }
    await execute(
      "UPDATE student_access_requests SET status=?,reviewed_at=?,reviewed_by=?,review_note=?,password_hash=NULL,user_id=? WHERE id=?",
      cmd.decision === "approve" ? "Approved" : "Rejected",
      new Date().toISOString(),
      s.displayName || "Registrar",
      cmd.note,
      userId,
      request.id,
    );
    await audit(
      "REGISTRAR",
      cmd.decision === "approve"
        ? "STUDENT_ACCESS_APPROVED"
        : "STUDENT_ACCESS_REJECTED",
      request.id,
      `Student access ${cmd.decision === "approve" ? "approved" : "rejected"} for ${request.student_id}.`,
      "ALLOWED",
      s,
    );
    return request.email;
  });
  let notified = true;
  try {
    await sendRegistrationDecisionEmail(email, cmd.decision === "approve");
  } catch {
    notified = false;
    console.error(
      "Student registration decision email could not be delivered.",
    );
  }
  return {
    ...(await registrationWorkspace(s)),
    message: `Request ${cmd.decision === "approve" ? "approved" : "rejected"}.${notified ? " Decision email prepared." : " Email notification failed; contact the student."}`,
  };
}
