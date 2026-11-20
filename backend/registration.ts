import { randomBytes } from "node:crypto";
import { z } from "zod";
import { hashPassword, strongPasswordSchema, tokenHash } from "./auth";
import { audit, execute, first, transaction } from "./store";
import {
  emailConfiguration,
  EmailUnavailable,
  sendVerificationEmail,
} from "./email";
import { evaluatePassword } from "@/shared/password";

export const studentContact = z.strictObject({
  studentId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,60}$/),
  email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
});
export const registrationVerification = z.strictObject({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: strongPasswordSchema,
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

async function diagnoseActivationFailure(
  studentId: string,
  email: string,
): Promise<RegistrationError> {
  const staff = await first<{ role: string }>(
    "SELECT role FROM users WHERE email=? AND role<>'STUDENT'",
    email,
  );
  if (staff) {
    return new RegistrationError(
      "This email belongs to a staff account. Staff accounts sign in directly and cannot use student activation.",
      400,
    );
  }
  const existing = await first<{
    id: string;
    email: string;
    student_id: string;
    active: number;
    activation_required: boolean;
  }>(
    "SELECT id,email,student_id,active,activation_required FROM users WHERE role='STUDENT' AND lower(student_id)=?",
    studentId.toLowerCase(),
  );
  if (existing) {
    if (!existing.active) {
      return new RegistrationError(
        "This student account is disabled. Contact the Registrar for assistance.",
        403,
      );
    }
    if (!existing.activation_required) {
      return new RegistrationError(
        "This student account is already activated. Sign in with your school ID and password, or use Forgot student password.",
        409,
      );
    }
    if (existing.email !== email) {
      return new RegistrationError(
        "That email does not match the enrollment email on file for this school ID. Confirm your email with the Registrar.",
        400,
      );
    }
    const sis = await first<{ enrollment_status: string; sis_email: string }>(
      "SELECT payload::jsonb->>'enrollmentStatus' AS enrollment_status, lower(btrim(payload::jsonb->>'email')) AS sis_email FROM sources WHERE feed='SIS' AND record_key=?",
      existing.student_id,
    );
    if (!sis) {
      return new RegistrationError(
        "No matching enrollment record was found on the SIS roster for this school ID. Contact the Registrar.",
        404,
      );
    }
    if (sis.enrollment_status !== "Active") {
      return new RegistrationError(
        "Only students with Active enrollment status can activate an account. Contact the Registrar.",
        403,
      );
    }
    return new RegistrationError(
      "Your enrollment record has an email mismatch or duplicate conflict on the SIS roster. Contact the Registrar to review it.",
      409,
    );
  }
  const onRoster = await first(
    "SELECT 1 FROM sources WHERE feed='SIS' AND lower(record_key)=?",
    studentId.toLowerCase(),
  );
  if (onRoster) {
    return new RegistrationError(
      "Your school ID is on the SIS roster, but your student account has not been provisioned yet. Ask the Registrar to provision student accounts from SIS.",
      409,
    );
  }
  return new RegistrationError(
    "No student account or enrollment record was found for that school ID. Check your school ID or contact the Registrar.",
    404,
  );
}

export async function requestStudentActivation(input: unknown) {
  const { studentId, email } = studentContact.parse(input);
  const config = emailConfiguration();
  const token = randomBytes(32).toString("hex");
  const hash = tokenHash(token);
  const now = Date.now();
  const outcome = await transaction(async () => {
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
    if (!pending) {
      return {
        error: await diagnoseActivationFailure(studentId, email),
      } as const;
    }
    await execute(
      "INSERT INTO student_registrations(token_hash,user_id,email,student_id,expires_at) VALUES(?,?,?,?,?)",
      hash,
      pending.id,
      pending.email,
      pending.student_id,
      now + 30 * 60000,
    );
    return { account: pending } as const;
  });
  if ("error" in outcome) {
    throw outcome.error;
  }
  const { account } = outcome;
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
  } catch (error) {
    await execute(
      "DELETE FROM student_registrations WHERE token_hash=?",
      hash,
    );
    console.error(
      "Student activation email could not be delivered. Check the email provider configuration.",
    );
    if (error instanceof EmailUnavailable) throw error;
    throw new EmailUnavailable();
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
  const initial = await findActivation(hash);
  if (!initial) throw invalidLink();

  const strength = evaluatePassword(password, [
    initial.student_id,
    initial.email.split("@")[0] || "",
  ]);
  if (!strength.valid) {
    throw new RegistrationError(
      strength.message || "Choose a stronger password.",
      400,
    );
  }

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
