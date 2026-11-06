import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import { execute, first, transaction } from "./store";
import type { AccessIdentity, UserRole } from "../types";
import { z } from "zod";

const derive = promisify(scrypt);
export const accountSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(200),
    displayName: z.string().trim().min(1).max(100),
    password: z.string().min(12).max(128),
    role: z.enum([
      "DEAN_REGISTRAR",
      "ACADEMIC_ADVISOR",
      "STUDENT",
      "COMPLIANCE_AUDITOR",
    ]),
    studentId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,60}$/)
      .optional(),
  })
  .refine((v) => v.role !== "STUDENT" || !!v.studentId, {
    message: "A student account requires a linked student ID",
    path: ["studentId"],
  });
export type SessionIdentity = AccessIdentity & { id: string; role: UserRole };
export function accountsRequired() {
  return process.env.VERCEL === "1" || process.env.EDM_AUTH_MODE === "accounts";
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !expected || expected.length !== 128)
    return false;
  const actual = (await derive(password, salt, 64)) as Buffer;
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
    await execute(
      "INSERT INTO users(id,email,display_name,password_hash,role,student_id) VALUES(?,?,?,?,?,?)",
      id,
      account.email,
      account.displayName,
      hash,
      account.role,
      account.role === "STUDENT" ? account.studentId! : null,
    );
  });
  return { id, email: account.email, role: account.role };
}
export async function resetPassword(email: string, password: string) {
  const normalized = z.email().parse(email.trim().toLowerCase());
  z.string().min(12).max(128).parse(password);
  const hash = await hashPassword(password);
  await transaction(async () => {
    const user = await first<{ id: string }>(
      "SELECT id FROM users WHERE email=?",
      normalized,
    );
    if (!user) throw new Error("Account not found.");
    await execute("UPDATE users SET password_hash=? WHERE id=?", hash, user.id);
    await execute("DELETE FROM sessions WHERE user_id=?", user.id);
    await execute("DELETE FROM login_attempts WHERE email=?", normalized);
  });
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function issueSession(role: UserRole, userId?: string) {
  const token = randomBytes(32).toString("hex"),
    maxAge = userId ? 8 * 3600 : 24 * 3600;
  await transaction(async () => {
    await execute("DELETE FROM sessions WHERE expires_at<=?", Date.now());
    await execute(
      "INSERT INTO sessions(id,role,expires_at,user_id) VALUES(?,?,?,?)",
      tokenHash(token),
      role,
      Date.now() + maxAge * 1000,
      userId || null,
    );
  });
  return { token, maxAge };
}
export async function readSession(
  token?: string,
): Promise<SessionIdentity | null> {
  if (!token) return null;
  const row = await first<{
    id: string;
    role: UserRole;
    user_id: string | null;
    account_role: UserRole | null;
    display_name: string | null;
    student_id: string | null;
    active: number | null;
  }>(
    "SELECT s.id,s.role,s.user_id,u.role AS account_role,u.display_name,u.student_id,u.active FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?",
    tokenHash(token),
    Date.now(),
  );
  if (!row) return null;
  if (row.user_id) {
    if (!row.active || !row.account_role) return null;
    return {
      id: row.id,
      role: row.account_role,
      mode: "account",
      userId: row.user_id,
      displayName: row.display_name!,
      ...(row.student_id ? { studentId: row.student_id } : {}),
    };
  }
  return accountsRequired()
    ? null
    : { id: row.id, role: row.role, mode: "demo" };
}
export async function revokeSession(token?: string) {
  if (token) await execute("DELETE FROM sessions WHERE id=?", tokenHash(token));
}
const dummyHash = "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
type LoginAttempt = { failures: number; retry_at: string | number };
export async function authenticate(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const attempt = await first<LoginAttempt>(
    "SELECT failures,retry_at FROM login_attempts WHERE email=?",
    normalized,
  );
  if (attempt && attempt.failures >= 5 && Number(attempt.retry_at) > Date.now())
    return { ok: false as const, locked: true };
  const user = await first<{
    id: string;
    password_hash: string;
    role: UserRole;
    active: number;
  }>(
    "SELECT id,password_hash,role,active FROM users WHERE email=?",
    normalized,
  );
  const verified = await verifyPassword(
    password,
    user?.password_hash || dummyHash,
  );
  if (!verified || !user?.active) {
    await transaction(async () => {
      const now = Date.now();
      const latest = await first<LoginAttempt>(
        "SELECT failures,retry_at FROM login_attempts WHERE email=?",
        normalized,
      );
      const failures =
        latest && Number(latest.retry_at) > now ? latest.failures + 1 : 1;
      await execute(
        "INSERT INTO login_attempts(email,failures,retry_at) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET failures=excluded.failures,retry_at=excluded.retry_at",
        normalized,
        failures,
        now + 15 * 60 * 1000,
      );
      await execute("DELETE FROM login_attempts WHERE retry_at<=?", now);
    });
    return { ok: false as const, locked: false };
  }
  await execute("DELETE FROM login_attempts WHERE email=?", normalized);
  return { ok: true as const, userId: user.id, role: user.role };
}
