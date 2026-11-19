import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, tokenHash } from "./auth";
import { audit, execute, first, transaction } from "./store";
import { emailConfiguration, sendVerificationEmail } from "./email";

export const studentContact = z.strictObject({
  studentId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,60}$/),
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
});
export const registrationVerification = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(12).max(128),
});

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
    "This activation link is invalid or expired. Request a new link, or sign in if your account is already active.",
  );

type PendingAccount = {
  id: string;
  email: string;
  student_id: string;
  display_name: string;
};

async function activationAccount(studentId: string, email: string) {
  return first<PendingAccount>(
    `SELECT u.id,u.email,u.student_id,u.display_name FROM users u
     JOIN sources sis ON sis.feed='SIS' AND sis.record_key=u.student_id
     WHERE u.role='STUDENT' AND u.active=1 AND u.activation_required
       AND lower(u.student_id)=? AND u.email=?
       AND sis.payload::jsonb->>'enrollmentStatus'='Active'
       AND lower(btrim(sis.payload::jsonb->>'email'))=u.email
       AND NOT EXISTS (
         SELECT 1 FROM sources other
         WHERE other.feed='SIS' AND other.record_key<>sis.record_key
           AND (lower(other.record_key)=lower(sis.record_key)
             OR lower(btrim(other.payload::jsonb->>'email'))=u.email)
       )`,
    studentId.toLowerCase(),
    email,
  );
}

export async function requestStudentActivation(input: unknown) {
  const { studentId, email } = studentContact.parse(input);
  const config = emailConfiguration();
  const token = randomBytes(32).toString("hex");
  const hash = tokenHash(token);
  const now = Date.now();
  const account = await transaction(async () => {
    await execute("DELETE FROM registration_limits WHERE window_end<=?", now);
    await execute("DELETE FROM student_registrations WHERE expires_at<=?", now);
    for (const key of [
      tokenHash(`email:${email}`),
      tokenHash(`student:${studentId.toLowerCase()}`),
    ]) {
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
      await execute(
        "INSERT INTO registration_limits(key,attempts,window_end,last_attempt) VALUES(?,1,?,?) ON CONFLICT(key) DO UPDATE SET attempts=registration_limits.attempts+1,last_attempt=excluded.last_attempt",
        key,
        now + 15 * 60000,
        now,
      );
    }
    const pending = await activationAccount(studentId, email);
    if (!pending) return undefined;
    await execute(
      "INSERT INTO student_registrations(token_hash,user_id,email,student_id,expires_at) VALUES(?,?,?,?,?)",
      hash,
      pending.id,
      pending.email,
      pending.student_id,
      now + 30 * 60000,
    );
    return pending;
  });
  if (account) {
    try {
      await sendVerificationEmail(account.email, token);
      await transaction(async () => {
        const delivered = await first(
          "UPDATE student_registrations SET delivered=1 WHERE token_hash=? RETURNING token_hash",
          hash,
        );
        if (delivered)
          await execute(
            "DELETE FROM student_registrations WHERE user_id=? AND expires_at<?",
            account.id,
            now + 30 * 60000,
          );
      });
    } catch {
      await execute(
        "DELETE FROM student_registrations WHERE token_hash=?",
        hash,
      );
      console.error(
        "Student activation email could not be delivered. Check the email provider configuration.",
      );
    }
  }
  return { ok: true, delivery: config.mode };
}

async function findActivation(hash: string) {
  return first<{ user_id: string; email: string; student_id: string }>(
    "SELECT user_id,email,student_id FROM student_registrations WHERE token_hash=? AND user_id IS NOT NULL AND delivered=1 AND expires_at>?",
    hash,
    Date.now(),
  );
}

export async function verifyStudentActivation(input: unknown) {
  const { token, password } = registrationVerification.parse(input);
  const hash = tokenHash(token);
  if (!(await findActivation(hash))) throw invalidLink();

  const passwordHash = await hashPassword(password);
  return transaction(async () => {
    const current = await findActivation(hash);
    if (!current) throw invalidLink();
    const account = await activationAccount(current.student_id, current.email);
    if (!account || account.id !== current.user_id) throw invalidLink();
    await execute(
      "UPDATE users SET password_hash=?,activation_required=FALSE WHERE id=?",
      passwordHash,
      account.id,
    );
    await execute(
      "DELETE FROM student_registrations WHERE user_id=?",
      account.id,
    );
    await execute("DELETE FROM sessions WHERE user_id=?", account.id);
    await execute("DELETE FROM password_resets WHERE user_id=?", account.id);
    await execute(
      "DELETE FROM registration_limits WHERE key=? OR key=?",
      tokenHash(`reset-email:${account.email}`),
      tokenHash(`reset-student:${account.student_id.toLowerCase()}`),
    );
    await execute(
      "DELETE FROM login_attempts WHERE email=? OR email=?",
      account.email,
      account.student_id.toLowerCase(),
    );
    await audit(
      "STUDENT",
      "STUDENT_REGISTERED",
      account.student_id,
      "Student set their first password using a single-use link sent to their enrollment email.",
      "ALLOWED",
      {
        mode: "account",
        userId: account.id,
        displayName: account.display_name,
        studentId: account.student_id,
      },
    );
    return { ok: true };
  });
}
