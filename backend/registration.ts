import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { hashPassword, tokenHash } from "./auth";
import { audit, execute, first, masters, transaction } from "./store";
import { emailConfiguration, sendVerificationEmail } from "./email";
import { DEPARTMENTS } from "@/shared/school";

export const registrationRequest = z
  .object({
    studentId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,60}$/),
    email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
    fullName: z.string().trim().min(2).max(100).optional(),
    department: z.enum(DEPARTMENTS).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.fullName) === Boolean(v.department), {
    message: "Provide both your name and department.",
  });
export const registrationVerification = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: z.string().min(12).max(128),
  })
  .strict();

export class RegistrationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const invalidLink = () =>
  new RegistrationError(
    "This verification link is invalid or expired. Request a new link, or sign in if you already have an account.",
  );
type Pending = {
  email: string;
  student_id: string;
  expires_at: string | number;
  delivered: number;
  display_name: string | null;
  department: string | null;
  review_required: number;
};

async function eligibility(
  studentId: string,
  email: string,
  allowReview: boolean,
) {
  if (
    await first(
      "SELECT 1 FROM users WHERE email=? OR lower(student_id)=lower(?)",
      email,
      studentId,
    )
  )
    return null;
  if (
    await first(
      "SELECT 1 FROM student_access_requests WHERE status='Pending' AND (email=? OR lower(student_id)=lower(?))",
      email,
      studentId,
    )
  )
    return null;
  const canonical = await first<{ id: string }>(
    "SELECT id FROM master WHERE lower(id)=lower(?)",
    studentId,
  );
  const [student] = canonical ? await masters(canonical.id) : [];
  if (student)
    return student.email.trim().toLowerCase() === email
      ? { review: false, studentId: student.studentId }
      : null;
  const staged = await first<{ payload: string; record_key: string }>(
    "SELECT payload,record_key FROM sources WHERE feed='SIS' AND lower(record_key)=lower(?)",
    studentId,
  );
  if (staged && JSON.parse(staged.payload).email.trim().toLowerCase() !== email)
    return null;
  return allowReview
    ? { review: true, studentId: staged?.record_key || studentId }
    : null;
}

async function available(studentId: string, email: string) {
  const [student] = await masters(studentId);
  if (!student || student.email.trim().toLowerCase() !== email) return null;
  if (
    await first(
      "SELECT 1 FROM users WHERE email=? OR lower(student_id)=lower(?)",
      email,
      studentId,
    )
  )
    return null;
  if (
    await first(
      "SELECT 1 FROM student_access_requests WHERE status='Pending' AND (email=? OR lower(student_id)=lower(?))",
      email,
      studentId,
    )
  )
    return null;
  return student;
}

export async function requestStudentRegistration(input: unknown) {
  const { studentId, email, fullName, department } =
    registrationRequest.parse(input);
  const config = emailConfiguration();
  const token = randomBytes(32).toString("hex"),
    hash = tokenHash(token);
  const now = Date.now();
  const eligible = await transaction(async () => {
    await execute("DELETE FROM registration_limits WHERE window_end<=?", now);
    await execute("DELETE FROM student_registrations WHERE expires_at<=?", now);
    const keys = [
      tokenHash(`email:${email}`),
      tokenHash(`student:${studentId.toLowerCase()}`),
    ];
    for (const key of keys) {
      const limit = await first<{
        attempts: number;
        last_attempt: string | number;
      }>(
        "SELECT attempts,last_attempt FROM registration_limits WHERE key=?",
        key,
      );
      if (
        limit &&
        (limit.attempts >= 5 || now - Number(limit.last_attempt) < 60000)
      )
        throw new RegistrationError(
          "Please wait before requesting another link. You can request up to five links every 15 minutes.",
          429,
        );
    }
    for (const key of keys)
      await execute(
        "INSERT INTO registration_limits(key,attempts,window_end,last_attempt) VALUES(?,1,?,?) ON CONFLICT(key) DO UPDATE SET attempts=registration_limits.attempts+1,last_attempt=excluded.last_attempt",
        key,
        now + 15 * 60000,
        now,
      );
    const match = await eligibility(
      studentId,
      email,
      !!fullName && !!department,
    );
    if (!match) return false;
    await execute(
      "INSERT INTO student_registrations(token_hash,email,student_id,expires_at,display_name,department,review_required) VALUES(?,?,?,?,?,?,?)",
      hash,
      email,
      match.studentId,
      now + 30 * 60000,
      fullName || null,
      department || null,
      match.review ? 1 : 0,
    );
    return true;
  });
  if (eligible) {
    try {
      await sendVerificationEmail(email, token);
      await transaction(async () => {
        await execute(
          "UPDATE student_registrations SET delivered=1 WHERE token_hash=?",
          hash,
        );
        await execute(
          "DELETE FROM student_registrations WHERE (email=? OR lower(student_id)=lower(?)) AND token_hash<>?",
          email,
          studentId,
          hash,
        );
      });
    } catch {
      await execute(
        "DELETE FROM student_registrations WHERE token_hash=?",
        hash,
      );
      // A delivery outage must not disclose which roster details matched.
      console.error(
        "Student verification email could not be delivered. Check the email provider configuration.",
      );
    }
  }
  // Identical public response for unknown IDs, mismatches and existing accounts.
  return { ok: true, delivery: config.mode };
}

export async function verifyStudentRegistration(input: unknown) {
  const { token, password } = registrationVerification.parse(input);
  const hash = tokenHash(token);
  const pending = await first<Pending>(
    "SELECT email,student_id,expires_at,delivered,display_name,department,review_required FROM student_registrations WHERE token_hash=?",
    hash,
  );
  if (!pending?.delivered || Number(pending.expires_at) <= Date.now())
    throw invalidLink();
  // Choose the password only after email ownership, never before sending the link.
  const passwordHash = await hashPassword(password);
  return transaction(async () => {
    const current = await first<Pending>(
      "SELECT email,student_id,expires_at,delivered,display_name,department,review_required FROM student_registrations WHERE token_hash=?",
      hash,
    );
    if (!current?.delivered || Number(current.expires_at) <= Date.now())
      throw invalidLink();
    if (current.review_required) {
      if (
        !current.display_name ||
        !current.department ||
        !(await eligibility(current.student_id, current.email, true))
      )
        throw invalidLink();
      const id = randomUUID(),
        now = new Date().toISOString();
      await execute(
        "INSERT INTO student_access_requests(id,student_id,email,display_name,department,password_hash,created_at,email_verified_at) VALUES(?,?,?,?,?,?,?,?)",
        id,
        current.student_id,
        current.email,
        current.display_name,
        current.department,
        passwordHash,
        now,
        now,
      );
      await execute(
        "DELETE FROM student_registrations WHERE email=? OR lower(student_id)=lower(?)",
        current.email,
        current.student_id,
      );
      await audit(
        "STUDENT",
        "STUDENT_ACCESS_REQUESTED",
        id,
        "Email verified; student access awaits Registrar approval.",
        "LOGGED",
        {
          mode: "account",
          displayName: current.display_name,
          studentId: current.student_id,
        },
      );
      return { ok: true, pendingApproval: true };
    }
    const student = await available(current.student_id, current.email);
    if (!student) throw invalidLink();
    const id = randomUUID();
    await execute(
      "INSERT INTO users(id,email,display_name,password_hash,role,student_id) VALUES(?,?,?,?,?,?)",
      id,
      current.email,
      student.fullName,
      passwordHash,
      "STUDENT",
      current.student_id,
    );
    await execute(
      "DELETE FROM student_registrations WHERE email=? OR lower(student_id)=lower(?)",
      current.email,
      current.student_id,
    );
    await execute("DELETE FROM login_attempts WHERE email=?", current.email);
    await audit(
      "STUDENT",
      "STUDENT_REGISTERED",
      current.student_id,
      "Student account activated after email verification.",
      "ALLOWED",
      {
        mode: "account",
        userId: id,
        displayName: student.fullName,
        studentId: current.student_id,
      },
    );
    return { ok: true };
  });
}
