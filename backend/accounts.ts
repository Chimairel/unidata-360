import { z } from "zod";
import { isAdminAuditEntry, STAFF_ROLES } from "@/shared/accounts";
import { DEPARTMENTS, isDepartment } from "@/shared/school";
import type { StaffAccount } from "@/shared/types";
import {
  createAccount,
  resetPassword,
  strongPasswordSchema,
  type SessionIdentity,
} from "./auth";
import {
  audit,
  execute,
  first,
  rows,
  transaction,
  verifyAuditRows,
  type AuditChainRow,
} from "./store";

const accessFields = {
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(STAFF_ROLES),
  department: z.enum(DEPARTMENTS).optional(),
};
const departmentValid = (v: { role: string; department?: string }) =>
  v.role === "DEAN" ? !!v.department : !v.department;
const departmentError = {
  message: "Assign a department to a Dean only.",
  path: ["department"],
};
const password = strongPasswordSchema;
export const accountCommand = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      ...accessFields,
      email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
      password,
    })
    .strict()
    .refine(departmentValid, departmentError),
  z
    .object({
      type: z.literal("update"),
      id: z.string().min(1).max(100),
      ...accessFields,
    })
    .strict()
    .refine(departmentValid, departmentError),
  z
    .object({
      type: z.literal("status"),
      id: z.string().min(1).max(100),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("password"),
      id: z.string().min(1).max(100),
      password,
    })
    .strict(),
]);
export class AccountManagementError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
export function isAccountAdministrator(identity: SessionIdentity) {
  return (
    identity.mode === "account" &&
    identity.role === "SYSTEM_ADMIN" &&
    !!identity.userId
  );
}
async function requireAdministrator(identity: SessionIdentity) {
  if (!isAccountAdministrator(identity))
    throw new AccountManagementError("System Admin access is required.");
  const actor = await first<{ role: string; active: number }>(
    "SELECT role,active FROM users WHERE id=?",
    identity.userId!,
  );
  if (actor?.role !== "SYSTEM_ADMIN" || !actor.active)
    throw new AccountManagementError("System Admin access is required.");
}
type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  role: StaffAccount["role"];
  department: string | null;
  active: number;
};
function project(row: AccountRow): StaffAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active === 1,
    ...(isDepartment(row.department) ? { department: row.department } : {}),
  };
}
export async function listStaffAccounts(identity: SessionIdentity) {
  await requireAdministrator(identity);
  return (
    await rows<AccountRow>(
      "SELECT id,email,display_name,role,department,active FROM users WHERE role<>'STUDENT' ORDER BY lower(display_name),id",
    )
  ).map(project);
}
export async function staffAccountsWorkspace(identity: SessionIdentity) {
  await requireAdministrator(identity);
  const row = await first<{
    accounts: AccountRow[];
    audit: AuditChainRow[];
  }>(
    `SELECT
       COALESCE((SELECT json_agg(u ORDER BY lower(display_name), id) FROM (
         SELECT id, email, display_name, role, department, active
         FROM users WHERE role<>'STUDENT'
         ORDER BY lower(display_name), id
       ) u), '[]'::json) AS accounts,
       COALESCE((SELECT json_agg(json_build_object('payload', payload, 'previous_hash', previous_hash, 'hash', hash) ORDER BY seq) FROM audit), '[]'::json) AS audit`,
  );
  const accounts = (row?.accounts || []).map(project);
  const trail = verifyAuditRows(row?.audit || []);
  return {
    accounts,
    activity: trail.entries.filter(isAdminAuditEntry),
  };
}
export async function manageStaffAccount(
  identity: SessionIdentity,
  input: unknown,
) {
  // Authorization precedes validation so other roles cannot probe staff details.
  if (!isAccountAdministrator(identity))
    throw new AccountManagementError("System Admin access is required.");
  const cmd = accountCommand.parse(input);
  return transaction(async () => {
    await requireAdministrator(identity);
    if (cmd.type === "create") {
      if (await first("SELECT 1 FROM users WHERE email=?", cmd.email))
        throw new AccountManagementError(
          "That email is already used by an account.",
          409,
        );
      const created = await createAccount(cmd);
      await audit(
        "SYSTEM_ADMIN",
        "ACCOUNT_CREATED",
        `Staff account ${created.id}`,
        `Created ${cmd.email} as ${cmd.role}${cmd.department ? ` in ${cmd.department}` : ""}.`,
        "ALLOWED",
        identity,
      );
      return "Staff account created. Share its sign-in details privately.";
    }
    const target = await first<AccountRow>(
      "SELECT id,email,display_name,role,department,active FROM users WHERE id=?",
      cmd.id,
    );
    if (!target)
      throw new AccountManagementError("Staff account not found.", 404);
    if (!(STAFF_ROLES as readonly string[]).includes(target.role))
      throw new AccountManagementError(
        "Student and System Admin accounts cannot be changed here.",
      );
    if (cmd.type === "password") {
      await resetPassword(target.email, cmd.password);
      await audit(
        "SYSTEM_ADMIN",
        "STAFF_PASSWORD_RESET",
        `Staff account ${target.id}`,
        `Reset the password for ${target.email}. Existing sessions revoked.`,
        "ALLOWED",
        identity,
      );
      return "Password updated. Previous sessions are signed out.";
    }
    if (cmd.type === "update") {
      await execute(
        "UPDATE users SET display_name=?,role=?,department=? WHERE id=?",
        cmd.displayName,
        cmd.role,
        cmd.department || null,
        target.id,
      );
      await audit(
        "SYSTEM_ADMIN",
        "ACCOUNT_UPDATED",
        `Staff account ${target.id}`,
        `Updated ${target.email}: ${target.display_name} (${target.role}${target.department ? ` / ${target.department}` : ""}) to ${cmd.displayName} (${cmd.role}${cmd.department ? ` / ${cmd.department}` : ""}).`,
        "ALLOWED",
        identity,
      );
    } else {
      await execute(
        "UPDATE users SET active=? WHERE id=?",
        cmd.active ? 1 : 0,
        target.id,
      );
      await execute("DELETE FROM login_attempts WHERE email=?", target.email);
      await audit(
        "SYSTEM_ADMIN",
        "ACCOUNT_STATUS_CHANGED",
        `Staff account ${target.id}`,
        `${cmd.active ? "Activated" : "Disabled"} ${target.email}. Existing sessions revoked.`,
        "ALLOWED",
        identity,
      );
    }
    await execute("DELETE FROM sessions WHERE user_id=?", target.id);
    await execute("DELETE FROM password_resets WHERE user_id=?", target.id);
    return cmd.type === "update"
      ? "Staff access updated. Previous sessions are signed out."
      : "Account status updated.";
  });
}
