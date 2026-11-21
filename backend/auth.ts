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
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  isBranch,
  type Branch,
} from "@/shared/retail";

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
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

export type SessionIdentity = AccessIdentity & { id: string; role: UserRole };

export function accountsRequired(): boolean {
  return process.env.EDM_AUTH_MODE === "strict";
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

let seededUsersPromise: Promise<void> | undefined;

export async function ensureDemoUsers() {
  if (!seededUsersPromise) {
    seededUsersPromise = (async () => {
      const existing = await first<{ c: string | number }>(
        "SELECT COUNT(*) AS c FROM retail_users",
      );
      if (Number(existing?.c || 0) >= DEMO_ACCOUNTS.length) return;
      const defaultHash = await hashPassword(DEMO_PASSWORD);
      for (const account of DEMO_ACCOUNTS) {
        await execute(
          `INSERT INTO retail_users(id, email, display_name, password_hash, role, branch, active)
           VALUES(?,?,?,?,?,?,1)
           ON CONFLICT(email) DO NOTHING`,
          randomUUID(),
          account.email,
          account.displayName,
          defaultHash,
          account.role,
          account.branch || null,
        );
      }
    })().catch((err) => {
      seededUsersPromise = undefined;
      throw err;
    });
  }
  await seededUsersPromise;
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueSession(
  role: UserRole,
  userId?: string,
  options?: {
    oldSessionToken?: string;
    skipUserCheck?: boolean;
  },
) {
  const token = randomBytes(32).toString("hex");
  const maxAge = userId ? 8 * 3600 : 24 * 3600;
  const now = Date.now();
  await transaction(async () => {
    if (
      userId &&
      !options?.skipUserCheck &&
      !(await first("SELECT 1 FROM retail_users WHERE id=? AND active=1", userId))
    ) {
      throw new Error("Account is not ready to sign in.");
    }
    const conditions = ["expires_at<=?"];
    const args: Array<string | number> = [now];
    if (options?.oldSessionToken) {
      conditions.push("id=?");
      args.push(tokenHash(options.oldSessionToken));
    }
    if (userId) {
      conditions.push(
        "(user_id=? AND id NOT IN (SELECT id FROM retail_sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 4))",
      );
      args.push(userId, userId);
    }
    await execute(
      `DELETE FROM retail_sessions WHERE ${conditions.join(" OR ")}`,
      ...args,
    );
    await execute(
      "INSERT INTO retail_sessions(id,role,expires_at,user_id) VALUES(?,?,?,?)",
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
  branch: string | null;
  active: number | null;
};

function sessionIdentityFromRow(
  row?: SessionRow,
  now?: number,
): SessionIdentity | null {
  if (!row) return null;
  if (now !== undefined && Number(row.expires_at) <= now) return null;
  if (row.user_id) {
    if (!row.active || !row.account_role) return null;
    if (row.account_role === "BRANCH_MANAGER" && !isBranch(row.branch))
      return null;
    return {
      id: row.id,
      role: row.account_role,
      mode: "account",
      userId: row.user_id,
      displayName: row.display_name!,
      ...(isBranch(row.branch) ? { branch: row.branch } : {}),
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
    `SELECT s.id, s.role, s.user_id, u.role AS account_role, u.display_name, u.branch, u.active
     FROM retail_sessions s
     LEFT JOIN retail_users u ON u.id=s.user_id
     WHERE s.id=? AND s.expires_at>?`,
    tokenHash(token),
    Date.now(),
  );
  return sessionIdentityFromRow(row);
}

export async function revokeAndReadSession(
  token?: string,
): Promise<SessionIdentity | null> {
  if (!token) return null;
  const now = Date.now();
  const row = await first<SessionRow>(
    `WITH deleted AS (
       DELETE FROM retail_sessions WHERE id=? RETURNING id, role, expires_at, user_id
     )
     SELECT d.id, d.role, d.expires_at, d.user_id,
            u.role AS account_role, u.display_name, u.branch, u.active
     FROM deleted d LEFT JOIN retail_users u ON u.id=d.user_id`,
    tokenHash(token),
  );
  return sessionIdentityFromRow(row, now);
}

const dummyHash =
  "scrypt:00000000000000000000000000000000:" + "00".repeat(64);

type LoginAttempt = { failures: number; retry_at: string | number };

export type AuthFailureReason = "locked" | "not_found" | "disabled" | "invalid_password";

export type AuthResult =
  | {
      ok: true;
      userId: string;
      role: UserRole;
      displayName: string;
      branch?: Branch;
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

export async function authenticate(
  emailInput: string,
  password: string,
): Promise<AuthResult> {
  await ensureDemoUsers();
  const normalized = emailInput.trim().toLowerCase();
  const user = await first<{
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: UserRole;
    branch: string | null;
    active: number;
    failures: number | null;
    retry_at: string | number | null;
  }>(
    `SELECT u.id, u.email, u.display_name, u.password_hash, u.role, u.branch, u.active,
            la.failures, la.retry_at
     FROM retail_users u
     LEFT JOIN retail_login_attempts la ON la.email=u.email
     WHERE u.email=?`,
    normalized,
  );
  const attempt: LoginAttempt | undefined = user
    ? user.failures !== null && user.retry_at !== null
      ? { failures: user.failures, retry_at: user.retry_at }
      : undefined
    : await first<LoginAttempt>(
        "SELECT failures, retry_at FROM retail_login_attempts WHERE email=?",
        normalized,
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

  const verified = await verifyPassword(
    password,
    user?.password_hash || dummyHash,
  );

  if (!verified || !user?.active) {
    let failures = 1;
    await transaction(async () => {
      const now = Date.now();
      const latest = await first<LoginAttempt>(
        "SELECT failures, retry_at FROM retail_login_attempts WHERE email=?",
        normalized,
      );
      failures =
        latest && Number(latest.retry_at) > now ? latest.failures + 1 : 1;
      await execute(
        `INSERT INTO retail_login_attempts(email, failures, retry_at) VALUES(?,?,?)
         ON CONFLICT(email) DO UPDATE SET failures=excluded.failures, retry_at=excluded.retry_at`,
        normalized,
        failures,
        now + 15 * 60 * 1000,
      );
      await execute("DELETE FROM retail_login_attempts WHERE retry_at<=?", now);
    });
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

  if (attempt) {
    await execute("DELETE FROM retail_login_attempts WHERE email=?", normalized);
  }
  return {
    ok: true,
    userId: user.id,
    role: user.role,
    displayName: user.display_name,
    ...(isBranch(user.branch) ? { branch: user.branch } : {}),
  };
}
