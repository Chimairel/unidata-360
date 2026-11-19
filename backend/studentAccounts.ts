import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isDepartment } from "@/shared/school";
import type { SISRecord } from "@/shared/types";
import type { StudentAccountsWorkspace } from "@/shared/registration";
import { tokenHash, type SessionIdentity } from "./auth";
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
import { requireWorkflowRole, WorkflowError } from "./workflow";

const command = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("provision") }),
  studentContact.extend({
    type: z.literal("update-email"),
    identityConfirmed: z.literal(true, {
      error: "Confirm you verified the student's identity.",
    }),
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
    for (let start = 0; start < eligible.length; start += 1000) {
      const batch = eligible.slice(start, start + 1000);
      const inserted = await rows(
        "INSERT INTO users(id,email,display_name,password_hash,role,student_id,department,activation_required) VALUES " +
          batch.map(() => "(?,?,?,'','STUDENT',?,?,TRUE)").join(",") +
          " ON CONFLICT DO NOTHING RETURNING id",
        ...batch.flatMap((student) => [
          randomUUID(),
          student.email,
          `${student.firstName} ${student.lastName}`,
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
  return `${created} student accounts created for activation.${conflicts ? ` ${conflicts} roster rows need an ID or email review.` : ""}`;
}

export async function studentAccountsWorkspace(
  s: SessionIdentity,
): Promise<StudentAccountsWorkspace> {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const counts = await first<{ pending: string; active: string }>(
    `SELECT count(*) FILTER (WHERE activation_required) AS pending,
            count(*) FILTER (WHERE NOT activation_required) AS active
     FROM users WHERE role='STUDENT' AND active=1`,
  );
  return {
    pending: Number(counts?.pending || 0),
    active: Number(counts?.active || 0),
  };
}

export async function manageStudentAccounts(
  s: SessionIdentity,
  input: unknown,
) {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const cmd = command.parse(input);
  if (cmd.type === "provision") {
    const { created, conflicts } = await provisionStudentAccounts(s);
    return {
      ...(await studentAccountsWorkspace(s)),
      message: studentProvisionSummary(created, conflicts),
    };
  }
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
    message: "Student email saved.",
  };
}
