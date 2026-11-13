import { randomBytes } from "node:crypto";
import {
  registrationRequest,
  registrationVerification,
  RegistrationError,
} from "./registration";
import { hashPassword, tokenHash } from "./auth";
import { emailConfiguration, sendPasswordResetEmail } from "./email";
import { audit, execute, first, transaction } from "./store";

const invalidLink = () =>
  new RegistrationError(
    "This password reset link is invalid or expired. Request a new link.",
  );
type Pending = {
  user_id: string;
  email: string;
  expires_at: string | number;
  delivered: number;
};
type Student = {
  id: string;
  email: string;
  display_name: string;
  student_id: string;
};

export async function requestStudentPasswordReset(input: unknown) {
  const { studentId, email } = registrationRequest.parse(input);
  const config = emailConfiguration();
  const token = randomBytes(32).toString("hex"),
    hash = tokenHash(token),
    now = Date.now();
  const student = await transaction(async () => {
    await execute("DELETE FROM registration_limits WHERE window_end<=?", now);
    await execute("DELETE FROM password_resets WHERE expires_at<=?", now);
    for (const key of [
      tokenHash(`reset-email:${email}`),
      tokenHash(`reset-student:${studentId.toLowerCase()}`),
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
    const user = await first<Student>(
      "SELECT id,email,display_name,student_id FROM users WHERE role='STUDENT' AND active=1 AND lower(student_id)=? AND email=?",
      studentId.toLowerCase(),
      email,
    );
    if (!user) return undefined;
    await execute(
      "INSERT INTO password_resets(token_hash,user_id,email,expires_at) VALUES(?,?,?,?)",
      hash,
      user.id,
      user.email,
      now + 30 * 60000,
    );
    return user;
  });
  if (student) {
    try {
      await sendPasswordResetEmail(student.email, token);
      await transaction(async () => {
        await execute(
          "UPDATE password_resets SET delivered=1 WHERE token_hash=?",
          hash,
        );
        await execute(
          "DELETE FROM password_resets WHERE user_id=? AND token_hash<>?",
          student.id,
          hash,
        );
      });
    } catch {
      await execute("DELETE FROM password_resets WHERE token_hash=?", hash);
      console.error(
        "Student password reset email could not be delivered. Check the email provider configuration.",
      );
    }
  }
  // Identical responses for unknown IDs, mismatched emails and staff accounts.
  return { ok: true, delivery: config.mode };
}

export async function resetStudentPassword(input: unknown) {
  const { token, password } = registrationVerification.parse(input);
  const hash = tokenHash(token);
  const pending = await first<Pending>(
    "SELECT user_id,email,expires_at,delivered FROM password_resets WHERE token_hash=?",
    hash,
  );
  if (!pending?.delivered || Number(pending.expires_at) <= Date.now())
    throw invalidLink();
  const passwordHash = await hashPassword(password);
  await transaction(async () => {
    const current = await first<Pending>(
      "SELECT user_id,email,expires_at,delivered FROM password_resets WHERE token_hash=?",
      hash,
    );
    if (!current?.delivered || Number(current.expires_at) <= Date.now())
      throw invalidLink();
    const user = await first<Student>(
      "SELECT id,email,display_name,student_id FROM users WHERE id=? AND role='STUDENT' AND active=1",
      current.user_id,
    );
    if (!user || user.email !== current.email) throw invalidLink();
    await execute(
      "UPDATE users SET password_hash=? WHERE id=?",
      passwordHash,
      user.id,
    );
    await execute("DELETE FROM sessions WHERE user_id=?", user.id);
    await execute(
      "DELETE FROM login_attempts WHERE email=? OR email=?",
      user.email,
      user.student_id.toLowerCase(),
    );
    await execute("DELETE FROM password_resets WHERE user_id=?", user.id);
    await audit(
      "STUDENT",
      "PASSWORD_RESET",
      "Account password",
      "Reset student password through a single-use email link. Existing sessions revoked.",
      "ALLOWED",
      {
        mode: "account",
        userId: user.id,
        displayName: user.display_name,
        studentId: user.student_id,
      },
    );
  });
  return { ok: true };
}
