import type { AccessIdentity, UserRole } from "@/shared/types";
import { isBranch, type Branch } from "@/shared/retail";

export function canManageOps(role: UserRole): boolean {
  return role === "OPS_MANAGER";
}

export function canRecordPOSSale(role: UserRole): boolean {
  return role === "OPS_MANAGER" || role === "BRANCH_MANAGER";
}

export function canToggleGDPR(role: UserRole): boolean {
  return role === "OPS_MANAGER" || role === "MARKETING_CRM";
}

export function canViewAnalytics(role: UserRole): boolean {
  return (
    role === "OPS_MANAGER" ||
    role === "MARKETING_CRM" ||
    role === "BRANCH_MANAGER"
  );
}

export function branchScope(
  role: UserRole,
  identity?: AccessIdentity,
): Branch | undefined {
  if (role !== "BRANCH_MANAGER") return undefined;
  return isBranch(identity?.branch) ? identity.branch : "Manila";
}

export function ownAuditOnly(role: UserRole): boolean {
  return role === "MARKETING_CRM" || role === "BRANCH_MANAGER";
}
