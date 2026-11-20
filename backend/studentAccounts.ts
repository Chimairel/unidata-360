import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isDepartment, type Department } from "@/shared/school";
import type { SISRecord } from "@/shared/types";
import type {
  StudentAccountSummary,
  StudentAccountsWorkspace,
} from "@/shared/registration";
import {
  DEFAULT_STUDENT_PASSWORD,
  hashPassword,
  tokenHash,
  type SessionIdentity,
} from "./auth";
import { studentContact } from "./registration";
import {
  audit,
  execute,
  first,
  rows,
  source,
  transaction,
  upsert,
} from "./store";
import {
  assertWorkflowRole,
  requireWorkflowRole,
  WorkflowError,
} from "./workflow";

const studentIdField = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{1,60}$/, "Enter a valid school ID.");

const command = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("provision") }),
  studentContact.extend({
    type: z.literal("update-email"),
    identityConfirmed: z.literal(true, {
      error: "Confirm you verified the student's identity.",
    }),
  }),
  z.strictObject({
    type: z.literal("reset-default"),
    studentId: studentIdField,
    identityConfirmed: z.literal(true, {
      error: "Confirm you verified the student's school ID.",
    }),
  }),
  z.strictObject({
    type: z.literal("status"),
    studentId: studentIdField,
    active: z.boolean(),
  }),
]);

export async function provisionStudentAccounts(
  s: SessionIdentity,
  importedIds?: ReadonlySet<string>,
) {
  return transaction(async () => {
    await requireWorkflowRole(s, ["REGISTRAR"]);
    const roster = await source<SISRecord>("SIS");
    const accounts = await rows<{
      student_id: string | null;
      email: string;
      activation_required: boolean;
    }>("SELECT student_id,email,activation_required FROM users");
    const existingIds = new Map(
      accounts
        .filter((a) => a.student_id)
        .map((a) => [a.student_id!.toLowerCase(), a]),
    );
    const existingEmails = new Set(accounts.map((a) => a.email.toLowerCase()));
    const emailCounts = new Map<string, number>();
    const idCounts = new Map<string, number>();
    for (const student of roster) {
      const email = student.email.trim().toLowerCase();
      const id = student.studentId.toLowerCase();
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      idCounts.set(id, (idCounts.get(id) || 0) + 1);
    }

    let conflicts = 0;
    const eligible = [];
    for (const student of roster) {
      const id = student.studentId.toLowerCase();
      if (
        student.enrollmentStatus !== "Active" ||
        (importedIds && !importedIds.has(id))
      )
        continue;
      const email = student.email.trim().toLowerCase();
      const existing = existingIds.get(id);
      if (existing) {
        if (existing.activation_required && existing.email !== email)
          conflicts++;
        continue;
      }
      if (
        !studentContact.safeParse({ studentId: student.studentId, email })
          .success ||
        !isDepartment(student.department) ||
        existingEmails.has(email) ||
        emailCounts.get(email) !== 1 ||
        idCounts.get(id) !== 1
      ) {
        conflicts++;
        continue;
      }
      eligible.push({ ...student, email });
    }

    let created = 0;
    const defaultPasswordHash = eligible.length
      ? await hashPassword(DEFAULT_STUDENT_PASSWORD)
      : "";
    for (let start = 0; start < eligible.length; start += 1000) {
      const batch = eligible.slice(start, start + 1000);
      const inserted = await rows(
        "INSERT INTO users(id,email,display_name,password_hash,role,student_id,department,activation_required) VALUES " +
          batch.map(() => "(?,?,?,?, 'STUDENT',?,?,TRUE)").join(",") +
          " ON CONFLICT DO NOTHING RETURNING id",
        ...batch.flatMap((student) => [
          randomUUID(),
          student.email,
          `${student.firstName} ${student.lastName}`,
          defaultPasswordHash,
          student.studentId,
          student.department,
        ]),
      );
      created += inserted.length;
      conflicts += batch.length - inserted.length;
    }
    if (created)
      await audit(
        "REGISTRAR",
        "STUDENT_ACCOUNTS_PROVISIONED",
        "Enrollment roster",
        `Provisioned ${created} student accounts pending activation.`,
        "ALLOWED",
        s,
      );
    return { created, conflicts };
  });
}

export function studentProvisionSummary(created: number, conflicts: number) {
  return `${created} student accounts created (default password: 123456; activation required on first sign-in).${conflicts ? ` ${conflicts} roster rows need an ID or email review.` : ""}`;
}

export async function studentAccountsWorkspace(
  s: SessionIdentity,
): Promise<StudentAccountsWorkspace> {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const list = await rows<{
    id: string;
    student_id: string | null;
    display_name: string;
    email: string;
    department: string | null;
    activation_required: boolean;
    active: number | boolean;
  }>(
    `SELECT id, student_id, display_name, email, department, activation_required, active
     FROM users
     WHERE role='STUDENT'
     ORDER BY active DESC, activation_required DESC, student_id ASC`,
  );
  const students: StudentAccountSummary[] = list.map((row) => ({
    id: row.id,
    studentId: row.student_id || "",
    displayName: row.display_name,
    email: row.email,
    department:
      row.department && isDepartment(row.department)
        ? (row.department as Department)
        : null,
    activationRequired: Boolean(row.activation_required),
    active: Boolean(row.active),
  }));
  const pending = students.filter(
    (item) => item.active && item.activationRequired,
  ).length;
  const active = students.filter(
    (item) => item.active && !item.activationRequired,
  ).length;
  const disabled = students.filter((item) => !item.active).length;
  return { pending, active, disabled, students };
}

export async function manageStudentAccounts(
  s: SessionIdentity,
  input: unknown,
) {
  assertWorkflowRole(s, ["REGISTRAR"]);
  const cmd = command.parse(input);
  if (cmd.type === "provision") {
    const { created, conflicts } = await provisionStudentAccounts(s);
    return {
      ...(await studentAccountsWorkspace(s)),
      message: studentProvisionSummary(created, conflicts),
    };
  }
  if (cmd.type === "reset-default") {
    let targetId = cmd.studentId;
    const defaultHash = await hashPassword(DEFAULT_STUDENT_PASSWORD);
    await transaction(async () => {
      await requireWorkflowRole(s, ["REGISTRAR"]);
      const account = await first<{
        id: string;
        email: string;
        student_id: string;
        active: number | boolean;
      }>(
        "SELECT id,email,student_id,active FROM users WHERE role='STUDENT' AND lower(student_id)=?",
        cmd.studentId.toLowerCase(),
      );
      if (!account)
        throw new WorkflowError(
          "No student account matches this school ID.",
          404,
        );
      if (!account.active)
        throw new WorkflowError(
          "Re-enable this student account before resetting its password to 123456.",
          409,
        );
      targetId = account.student_id;
      await execute(
        "UPDATE users SET password_hash=?, activation_required=TRUE WHERE id=?",
        defaultHash,
        account.id,
      );
      await execute("DELETE FROM sessions WHERE user_id=?", account.id);
      await execute(
        "DELETE FROM onboarding_sessions WHERE user_id=?",
        account.id,
      );
      await execute("DELETE FROM password_resets WHERE user_id=?", account.id);
      await execute(
        "DELETE FROM student_registrations WHERE user_id=?",
        account.id,
      );
      await execute(
        "DELETE FROM login_attempts WHERE email=? OR email=?",
        account.email,
        account.student_id.toLowerCase(),
      );
      await audit(
        "REGISTRAR",
        "STUDENT_PASSWORD_RESET_DEFAULT",
        account.student_id,
        "Registrar verified student ID and reset the portal password to default (123456); activation required on next sign-in.",
        "ALLOWED",
        s,
      );
    });
    return {
      ...(await studentAccountsWorkspace(s)),
      message: `Reset ${targetId} to default password (123456). Active sessions were signed out and activation is required on next sign-in.`,
    };
  }
  if (cmd.type === "status") {
    let targetId = cmd.studentId;
    await transaction(async () => {
      await requireWorkflowRole(s, ["REGISTRAR"]);
      const account = await first<{
        id: string;
        student_id: string;
        active: number | boolean;
      }>(
        "SELECT id,student_id,active FROM users WHERE role='STUDENT' AND lower(student_id)=?",
        cmd.studentId.toLowerCase(),
      );
      if (!account)
        throw new WorkflowError(
          "No student account matches this school ID.",
          404,
        );
      targetId = account.student_id;
      await execute(
        "UPDATE users SET active=? WHERE id=?",
        cmd.active ? 1 : 0,
        account.id,
      );
      if (!cmd.active) {
        await execute("DELETE FROM sessions WHERE user_id=?", account.id);
        await execute(
          "DELETE FROM onboarding_sessions WHERE user_id=?",
          account.id,
        );
      }
      await audit(
        "REGISTRAR",
        "STUDENT_STATUS_CHANGED",
        account.student_id,
        cmd.active
          ? "Registrar re-enabled student portal access."
          : "Registrar disabled student portal access and revoked active sessions.",
        "ALLOWED",
        s,
      );
    });
    return {
      ...(await studentAccountsWorkspace(s)),
      message: cmd.active
        ? `Re-enabled portal access for ${targetId}.`
        : `Disabled portal access for ${targetId} and signed out active sessions.`,
    };
  }
  let sourceUpdated = false;
  await transaction(async () => {
    await requireWorkflowRole(s, ["REGISTRAR"]);
    const account = await first<{
      id: string;
      email: string;
      student_id: string;
    }>(
      "SELECT id,email,student_id FROM users WHERE role='STUDENT' AND active=1 AND lower(student_id)=?",
      cmd.studentId.toLowerCase(),
    );
    if (!account)
      throw new WorkflowError(
        "No enabled student account matches this school ID.",
        404,
      );
    if (
      await first(
        "SELECT 1 FROM users WHERE lower(email)=? AND id<>?",
        cmd.email,
        account.id,
      )
    )
      throw new WorkflowError(
        "That email already belongs to another account.",
        409,
      );
    const current = await first<{ payload: string }>(
      "SELECT payload FROM sources WHERE feed='SIS' AND record_key=?",
      account.student_id,
    );
    let sourceChanged = false;
    if (current) {
      const student: SISRecord = JSON.parse(current.payload);
      if (student.email !== cmd.email) {
        await upsert("SIS", [{ ...student, email: cmd.email }], s);
        sourceChanged = true;
        sourceUpdated = true;
      }
    }
    if (sourceChanged || account.email !== cmd.email) {
      await execute(
        "DELETE FROM student_registrations WHERE user_id=?",
        account.id,
      );
      await execute(
        "DELETE FROM registration_limits WHERE key=? OR key=? OR key=?",
        tokenHash(`student:${account.student_id.toLowerCase()}`),
        tokenHash(`reset-student:${account.student_id.toLowerCase()}`),
        tokenHash(`email:${cmd.email}`),
      );
    }
    if (account.email !== cmd.email) {
      await execute(
        "UPDATE users SET email=? WHERE id=?",
        cmd.email,
        account.id,
      );
      await execute("DELETE FROM password_resets WHERE user_id=?", account.id);
      await execute("DELETE FROM sessions WHERE user_id=?", account.id);
      await execute(
        "DELETE FROM login_attempts WHERE email=? OR email=?",
        account.email,
        account.student_id.toLowerCase(),
      );
    }
    await audit(
      "REGISTRAR",
      "STUDENT_EMAIL_UPDATED",
      account.student_id,
      "Registrar confirmed student identity and saved the student contact email.",
      "ALLOWED",
      s,
    );
  });
  return {
    ...(await studentAccountsWorkspace(s)),
    message: sourceUpdated
      ? "Student email saved. Run ETL to refresh Student 360."
      : "Student email saved.",
  };
}
