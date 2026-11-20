import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  randomUUID,
  type ScryptOptions,
} from "node:crypto";
import { execute, first, transaction } from "./store";
import type { AccessIdentity, UserRole } from "@/shared/types";
import { z } from "zod";
import { DEPARTMENTS, isDepartment, type Department } from "@/shared/school";
import { evaluatePassword } from "@/shared/password";

function derive(
  password: string,
  salt: string,
  keylen: number,
  options?: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, derivedKey: Buffer) =>
      err ? reject(err) : resolve(derivedKey);
    if (options) scrypt(password, salt, keylen, options, cb);
    else scrypt(password, salt, keylen, cb);
  });
}

const SCRYPT2_OPTIONS: ScryptOptions = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

export const strongPasswordSchema = z
  .string()
  .min(12, "Password must be 12–128 characters.")
  .max(128, "Password must be 12–128 characters.")
  .superRefine((value, ctx) => {
    const check = evaluatePassword(value);
    if (!check.valid) {
      ctx.addIssue({
        code: "custom",
        message:
          check.message ||
          "Use 12–128 characters with at least 3 character types.",
      });
    }
  });

export const accountSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(200),
    displayName: z.string().trim().min(1).max(100),
    password: strongPasswordSchema,
    role: z.enum([
      "SYSTEM_ADMIN",
      "REGISTRAR",
      "DEAN",
      "ACADEMIC_ADVISOR",
      "STUDENT",
      "COMPLIANCE_AUDITOR",
    ]),
    studentId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,60}$/)
      .optional(),
    department: z.enum(DEPARTMENTS).optional(),
  })
  .refine((v) => v.role !== "STUDENT" || !!v.studentId, {
    message: "A student account requires a linked student ID",
    path: ["studentId"],
  })
  .refine((v) => v.role !== "DEAN" || !!v.department, {
    message:
      "A Dean account requires BSIT, BEED, BSED or BSHM department assignment",
    path: ["department"],
  });
export type SessionIdentity = AccessIdentity & { id: string; role: UserRole };
export function accountsRequired() {
  return process.env.VERCEL === "1" || process.env.EDM_AUTH_MODE === "accounts";
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64, SCRYPT2_OPTIONS);
  return `scrypt2:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split(":");
  if (
    (algorithm !== "scrypt" && algorithm !== "scrypt2") ||
    !salt ||
    !expected ||
    expected.length !== 128
  )
    return false;
  const actual =
    algorithm === "scrypt2"
      ? await derive(password, salt, 64, SCRYPT2_OPTIONS)
      : await derive(password, salt, 64);
  const target = Buffer.from(expected, "hex");
  return target.length === actual.length && timingSafeEqual(actual, target);
}

export async function createAccount(input: unknown) {
  const account = accountSchema.parse(input);
  const id = randomUUID();
  const hash = await hashPassword(account.password);
  await transaction(async () => {
    if (
      account.role === "STUDENT" &&
      !(await first("SELECT 1 FROM master WHERE id=?", account.studentId!))
    ) {
      throw new Error(
        "Student ID must exist in the master store. Import it and run ETL first.",
      );
    }
    if (
      account.role === "STUDENT" &&
      (await first(
        "SELECT 1 FROM users WHERE student_id=?",
        account.studentId!,
      ))
    )
      throw new Error("A student account already exists for this student ID.");
    await execute(
      "INSERT INTO users(id,email,display_name,password_hash,role,student_id,department) VALUES(?,?,?,?,?,?,?)",
      id,
      account.email,
      account.displayName,
      hash,
      account.role,
      account.role === "STUDENT" ? account.studentId! : null,
      account.role === "DEAN" ? account.department! : null,
    );
  });
  return { id, email: account.email, role: account.role };
}
export async function resetPassword(email: string, password: string) {
  const normalized = z.email().parse(email.trim().toLowerCase());
  strongPasswordSchema.parse(password);
  const hash = await hashPassword(password);
  await transaction(async () => {
    const user = await first<{ id: string; activation_required: boolean }>(
      "SELECT id,activation_required FROM users WHERE email=?",
      normalized,
    );
    if (!user) throw new Error("Account not found.");
    if (user.activation_required)
      throw new Error("This student must activate their account first.");
    await execute("UPDATE users SET password_hash=? WHERE id=?", hash, user.id);
    await execute("DELETE FROM sessions WHERE user_id=?", user.id);
    await execute("DELETE FROM password_resets WHERE user_id=?", user.id);
    await execute("DELETE FROM login_attempts WHERE email=?", normalized);
  });
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function issueSession(
  role: UserRole,
  userId?: string,
  options?: {
    oldSessionToken?: string;
    oldOnboardingToken?: string;
    skipUserCheck?: boolean;
  },
) {
  const token = randomBytes(32).toString("hex"),
    maxAge = userId ? 8 * 3600 : 24 * 3600;
  const now = Date.now();
  await transaction(async () => {
    if (
      userId &&
      !options?.skipUserCheck &&
      !(await first(
        "SELECT 1 FROM users WHERE id=? AND active=1 AND NOT activation_required",
        userId,
      ))
    )
      throw new Error("Account is not ready to sign in.");
    const conditions = ["expires_at<=?"];
    const args: Array<string | number> = [now];
    if (options?.oldSessionToken) {
      conditions.push("id=?");
      args.push(tokenHash(options.oldSessionToken));
    }
    if (userId) {
      // Cap concurrent sessions per user at 5 (keep 4 newest before inserting this one).
      conditions.push(
        "(user_id=? AND id NOT IN (SELECT id FROM sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 4))",
      );
      args.push(userId, userId);
    }
    await execute(`DELETE FROM sessions WHERE ${conditions.join(" OR ")}`, ...args);
    if (options?.oldOnboardingToken) {
      await execute(
        "DELETE FROM onboarding_sessions WHERE token_hash=?",
        tokenHash(options.oldOnboardingToken),
      );
    }
    await execute(
      "INSERT INTO sessions(id,role,expires_at,user_id) VALUES(?,?,?,?)",
      tokenHash(token),
      role,
      now + maxAge * 1000,
      userId || null,
    );
  });
  return { token, maxAge };
}
type SessionRow = {
  id: string;
  role: UserRole;
  expires_at?: string | number;
  user_id: string | null;
  account_role: UserRole | null;
  display_name: string | null;
  student_id: string | null;
  department: string | null;
  active: number | null;
  activation_required: boolean | null;
};

function sessionIdentityFromRow(
  row?: SessionRow,
  now?: number,
): SessionIdentity | null {
  if (!row) return null;
  if (now !== undefined && Number(row.expires_at) <= now) return null;
  if (row.user_id) {
    if (!row.active || row.activation_required || !row.account_role)
      return null;
    if (row.account_role === "DEAN" && !isDepartment(row.department))
      return null;
    return {
      id: row.id,
      role: row.account_role,
      mode: "account",
      userId: row.user_id,
      displayName: row.display_name!,
      ...(row.student_id ? { studentId: row.student_id } : {}),
      ...(isDepartment(row.department) ? { department: row.department } : {}),
    };
  }
  return accountsRequired()
    ? null
    : { id: row.id, role: row.role, mode: "demo" };
}

export async function readSession(
  token?: string,
): Promise<SessionIdentity | null> {
  if (!token) return null;
  const row = await first<SessionRow>(
    "SELECT s.id,s.role,s.user_id,u.role AS account_role,u.display_name,u.student_id,u.department,u.active,u.activation_required FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?",
    tokenHash(token),
    Date.now(),
  );
  return sessionIdentityFromRow(row);
}
export async function revokeSession(token?: string) {
  if (token) await execute("DELETE FROM sessions WHERE id=?", tokenHash(token));
}
export async function revokeAndReadSession(
  token?: string,
  onboardingToken?: string,
): Promise<SessionIdentity | null> {
  if (!token && !onboardingToken) return null;
  if (onboardingToken) {
    await execute(
      "DELETE FROM onboarding_sessions WHERE token_hash=?",
      tokenHash(onboardingToken),
    );
  }
  if (!token) return null;
  const now = Date.now();
  const row = await first<SessionRow>(
    `WITH deleted AS (
       DELETE FROM sessions WHERE id=? RETURNING id,role,expires_at,user_id
     )
     SELECT d.id,d.role,d.expires_at,d.user_id,
            u.role AS account_role,u.display_name,u.student_id,u.department,u.active,u.activation_required
     FROM deleted d LEFT JOIN users u ON u.id=d.user_id`,
    tokenHash(token),
  );
  return sessionIdentityFromRow(row, now);
}
const dummyHash = "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
export const DEFAULT_STUDENT_PASSWORD = "123456";
type LoginAttempt = { failures: number; retry_at: string | number };
export type AuthFailureReason =
  | "locked"
  | "student_used_email"
  | "not_found"
  | "disabled"
  | "activation_required"
  | "invalid_password";
export type AuthResult =
  | {
      ok: true;
      onboardingRequired?: false;
      userId: string;
      role: UserRole;
      displayName: string;
      studentId?: string;
      department?: Department;
    }
  | {
      ok: true;
      onboardingRequired: true;
      userId: string;
      role: "STUDENT";
      studentId: string;
      displayName: string;
      email: string;
    }
  | {
      ok: false;
      locked: boolean;
      reason: AuthFailureReason;
      remainingAttempts?: number;
      retryMinutes?: number;
      userId?: string;
      role?: UserRole;
      displayName?: string;
    };

export type OnboardingIdentity = {
  userId: string;
  studentId: string;
  displayName: string;
  email: string;
  department?: string;
};

function matchesDefaultPassword(candidate: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(DEFAULT_STUDENT_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

export async function issueOnboardingSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const maxAge = 15 * 60;
  await transaction(async () => {
    const user = await first(
      "SELECT 1 FROM users WHERE id=? AND role='STUDENT' AND active=1 AND activation_required",
      userId,
    );
    if (!user) throw new Error("Account does not require activation.");
    await execute(
      "DELETE FROM onboarding_sessions WHERE expires_at<=? OR user_id=?",
      Date.now(),
      userId,
    );
    await execute(
      "INSERT INTO onboarding_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      tokenHash(token),
      userId,
      Date.now() + maxAge * 1000,
    );
  });
  return { token, maxAge };
}

export async function readOnboardingSession(
  token?: string,
): Promise<OnboardingIdentity | null> {
  if (!token) return null;
  const row = await first<{
    user_id: string;
    student_id: string | null;
    display_name: string;
    email: string;
    department: string | null;
  }>(
    `SELECT u.id AS user_id, u.student_id, u.display_name, u.email, u.department
     FROM onboarding_sessions o
     JOIN users u ON u.id = o.user_id
     WHERE o.token_hash=? AND o.expires_at>? AND u.role='STUDENT' AND u.active=1 AND u.activation_required`,
    tokenHash(token),
    Date.now(),
  );
  if (!row || !row.student_id) return null;
  return {
    userId: row.user_id,
    studentId: row.student_id,
    displayName: row.display_name,
    email: row.email,
    ...(row.department ? { department: row.department } : {}),
  };
}

export async function revokeOnboardingSession(token?: string) {
  if (token)
    await execute(
      "DELETE FROM onboarding_sessions WHERE token_hash=?",
      tokenHash(token),
    );
}

export async function completeStudentOnboarding(
  token: string,
  confirmEmail: string,
  newPassword: string,
  afterComplete?: (student: OnboardingIdentity) => Promise<void>,
) {
  const initial = await readOnboardingSession(token);
  if (!initial)
    throw new Error(
      "Your activation session expired. Sign in again with your School ID and default password (123456).",
    );
  const normalizedEmail = confirmEmail.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail !== initial.email.toLowerCase()) {
    throw new Error(
      "That email does not match your enrollment email on file. Confirm your email with the Registrar.",
    );
  }
  if (newPassword === DEFAULT_STUDENT_PASSWORD) {
    throw new Error("Choose a new personal password instead of 123456.");
  }
  const strength = evaluatePassword(newPassword, [
    initial.studentId,
    initial.email.split("@")[0] || "",
  ]);
  if (!strength.valid) {
    throw new Error(strength.message || "Choose a stronger password.");
  }
  const hash = await hashPassword(newPassword);
  return transaction(async () => {
    const current = await readOnboardingSession(token);
    if (!current)
      throw new Error(
        "Your activation session expired. Sign in again with your School ID and default password (123456).",
      );
    await execute(
      "UPDATE users SET password_hash=?,activation_required=FALSE WHERE id=?",
      hash,
      current.userId,
    );
    await execute(
      "DELETE FROM onboarding_sessions WHERE user_id=?",
      current.userId,
    );
    await execute(
      "DELETE FROM student_registrations WHERE user_id=?",
      current.userId,
    );
    await execute("DELETE FROM password_resets WHERE user_id=?", current.userId);
    await execute("DELETE FROM sessions WHERE user_id=?", current.userId);
    await execute(
      "DELETE FROM login_attempts WHERE email=? OR email=?",
      current.email,
      current.studentId.toLowerCase(),
    );
    if (afterComplete) await afterComplete(current);
    return current;
  });
}

export async function authenticate(
  identifier: string,
  password: string,
): Promise<AuthResult> {
  const normalized = identifier.trim().toLowerCase();
  const isEmail = normalized.includes("@");
  const user = await first<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: UserRole;
    student_id: string | null;
    department: string | null;
    active: number;
    activation_required: boolean;
    failures: number | null;
    retry_at: string | number | null;
  }>(
    isEmail
      ? "SELECT u.id,u.email,u.display_name,u.password_hash,u.role,u.student_id,u.department,u.active,u.activation_required,la.failures,la.retry_at FROM users u LEFT JOIN login_attempts la ON la.email=u.email WHERE u.email=? AND u.role<>'STUDENT'"
      : "SELECT u.id,u.email,u.display_name,u.password_hash,u.role,u.student_id,u.department,u.active,u.activation_required,la.failures,la.retry_at FROM users u LEFT JOIN login_attempts la ON la.email=u.email WHERE lower(u.student_id)=? AND u.role='STUDENT'",
    normalized,
  );
  const studentByEmail =
    !user && isEmail
      ? await first<{
          id: string;
          email: string;
          display_name: string;
          failures: number | null;
          retry_at: string | number | null;
        }>(
          "SELECT u.id,u.email,u.display_name,la.failures,la.retry_at FROM users u LEFT JOIN login_attempts la ON la.email=u.email WHERE u.email=? AND u.role='STUDENT'",
          normalized,
        )
      : undefined;

  // Keep one lockout key per account, including existing email-keyed lockouts.
  const attemptKey = user?.email || studentByEmail?.email || normalized;
  const attempt: LoginAttempt | undefined = user
    ? user.failures !== null && user.retry_at !== null
      ? { failures: user.failures, retry_at: user.retry_at }
      : undefined
    : studentByEmail
      ? studentByEmail.failures !== null && studentByEmail.retry_at !== null
        ? { failures: studentByEmail.failures, retry_at: studentByEmail.retry_at }
        : undefined
      : await first<LoginAttempt>(
          "SELECT failures,retry_at FROM login_attempts WHERE email=?",
          attemptKey,
        );
  if (attempt && attempt.failures >= 5 && Number(attempt.retry_at) > Date.now()) {
    const retryMinutes = Math.max(
      1,
      Math.ceil((Number(attempt.retry_at) - Date.now()) / 60000),
    );
    return {
      ok: false,
      locked: true,
      reason: "locked",
      retryMinutes,
      userId: user?.id,
      role: user?.role,
      displayName: user?.display_name,
    };
  }

  let verified = false;
  if (user?.activation_required && user.role === "STUDENT") {
    verified = user.password_hash
      ? await verifyPassword(password, user.password_hash)
      : matchesDefaultPassword(password);
    if (!verified && user.password_hash) {
      // Allow 123456 fallback if a legacy pending student record has an empty/placeholder hash
      await verifyPassword(password, dummyHash);
    }
  } else {
    verified = await verifyPassword(password, user?.password_hash || dummyHash);
  }

  if (!verified || !user?.active) {
    let failures = 1;
    await transaction(async () => {
      const now = Date.now();
      const latest = await first<LoginAttempt>(
        "SELECT failures,retry_at FROM login_attempts WHERE email=?",
        attemptKey,
      );
      failures =
        latest && Number(latest.retry_at) > now ? latest.failures + 1 : 1;
      await execute(
        "INSERT INTO login_attempts(email,failures,retry_at) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET failures=excluded.failures,retry_at=excluded.retry_at",
        attemptKey,
        failures,
        now + 15 * 60 * 1000,
      );
      await execute("DELETE FROM login_attempts WHERE retry_at<=?", now);
    });
    if (studentByEmail) {
      return {
        ok: false,
        locked: failures >= 5,
        reason: "student_used_email",
        remainingAttempts: Math.max(0, 5 - failures),
        userId: studentByEmail.id,
        role: "STUDENT",
        displayName: studentByEmail.display_name,
      };
    }
    if (!user) {
      return {
        ok: false,
        locked: failures >= 5,
        reason: "not_found",
        remainingAttempts: Math.max(0, 5 - failures),
      };
    }
    if (!user.active) {
      return {
        ok: false,
        locked: false,
        reason: "disabled",
        userId: user.id,
        role: user.role,
        displayName: user.display_name,
      };
    }
    return {
      ok: false,
      locked: failures >= 5,
      reason: failures >= 5 ? "locked" : "invalid_password",
      remainingAttempts: Math.max(0, 5 - failures),
      retryMinutes: failures >= 5 ? 15 : undefined,
      userId: user.id,
      role: user.role,
      displayName: user.display_name,
    };
  }

  if (attempt)
    await execute("DELETE FROM login_attempts WHERE email=?", attemptKey);
  if (user.activation_required && user.role === "STUDENT" && user.student_id) {
    return {
      ok: true,
      onboardingRequired: true,
      userId: user.id,
      role: "STUDENT",
      studentId: user.student_id,
      displayName: user.display_name,
      email: user.email,
    };
  }
  return {
    ok: true,
    userId: user.id,
    role: user.role,
    displayName: user.display_name,
    ...(user.student_id ? { studentId: user.student_id } : {}),
    ...(isDepartment(user.department) ? { department: user.department } : {}),
  };
}
