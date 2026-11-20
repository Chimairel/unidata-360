import { randomBytes } from "node:crypto";
import {
  studentContact,
  registrationVerification,
  RegistrationError,
} from "./registration";
import { hashPassword, tokenHash } from "./auth";
import {
  emailConfiguration,
  EmailUnavailable,
  sendPasswordResetEmail,
} from "./email";
import { audit, execute, first, transaction } from "./store";
import { evaluatePassword } from "@/shared/password";

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
  active: number;
  activation_required: boolean;
};

export async function requestStudentPasswordReset(input: unknown) {
  const { studentId, email } = studentContact.parse(input);
  const config = emailConfiguration();
  const token = randomBytes(32).toString("hex"),
    hash = tokenHash(token),
    now = Date.now();
  const outcome = await transaction(async () => {
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
    const staff = await first<{ role: string }>(
      "SELECT role FROM users WHERE email=? AND role<>'STUDENT'",
      email,
    );
    if (staff) {
      return {
        error: new RegistrationError(
          "Staff accounts cannot reset passwords here. Contact your System Administrator to reset a staff password.",
          400,
        ),
      } as const;
    }
    const user = await first<Student>(
      "SELECT id,email,display_name,student_id,active,activation_required FROM users WHERE role='STUDENT' AND lower(student_id)=?",
      studentId.toLowerCase(),
    );
    if (!user) {
      return {
        error: new RegistrationError(
          "No registered student account was found for that school ID. Check your school ID or activate your student account first.",
          404,
        ),
      } as const;
    }
    if (!user.active) {
      return {
        error: new RegistrationError(
          "This student account is disabled. Contact the Registrar for assistance.",
          403,
        ),
      } as const;
    }
    if (user.activation_required) {
      return {
        error: new RegistrationError(
          "This student account has not been activated yet. Use 'Activate student account' to set your first password.",
          409,
        ),
      } as const;
    }
    if (user.email !== email) {
      return {
        error: new RegistrationError(
          "That email does not match the registered email for this school ID. Confirm your email with the Registrar.",
          400,
        ),
      } as const;
    }
    await execute(
      "INSERT INTO password_resets(token_hash,user_id,email,expires_at) VALUES(?,?,?,?)",
      hash,
      user.id,
      user.email,
      now + 30 * 60000,
    );
    return { student: user } as const;
  });
  if ("error" in outcome) {
    throw outcome.error;
  }
  const { student } = outcome;
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
  } catch (error) {
    await execute("DELETE FROM password_resets WHERE token_hash=?", hash);
    console.error(
      "Student password reset email could not be delivered. Check the email provider configuration.",
    );
    if (error instanceof EmailUnavailable) throw error;
    throw new EmailUnavailable();
  }
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
  const initialUser = await first<Student>(
    "SELECT id,email,display_name,student_id,active,activation_required FROM users WHERE id=? AND role='STUDENT' AND active=1 AND NOT activation_required",
    pending.user_id,
  );
  if (!initialUser || initialUser.email !== pending.email) throw invalidLink();
  const strength = evaluatePassword(password, [
    initialUser.student_id,
    initialUser.email.split("@")[0] || "",
  ]);
  if (!strength.valid) {
    throw new RegistrationError(
      strength.message || "Choose a stronger password.",
      400,
    );
  }
  const passwordHash = await hashPassword(password);
  await transaction(async () => {
    const current = await first<Pending>(
      "SELECT user_id,email,expires_at,delivered FROM password_resets WHERE token_hash=?",
      hash,
    );
    if (!current?.delivered || Number(current.expires_at) <= Date.now())
      throw invalidLink();
    const user = await first<Student>(
      "SELECT id,email,display_name,student_id,active,activation_required FROM users WHERE id=? AND role='STUDENT' AND active=1 AND NOT activation_required",
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
