import type { AccessIdentity, UserRole } from "@/shared/types";
import { isBranch, WALK_IN_CUSTOMER_ID, type Branch } from "@/shared/retail";

export function canManageOps(role: UserRole): boolean {
  return role === "OPS_MANAGER";
}

export function canRecordPOSSale(role: UserRole): boolean {
  return (
    role === "OPS_MANAGER" || role === "BRANCH_MANAGER" || role === "CASHIER"
  );
}

export function canManageInventory(role: UserRole): boolean {
  return role === "OPS_MANAGER" || role === "INVENTORY_STAFF";
}

export function canManageDeliveries(role: UserRole): boolean {
  return role === "OPS_MANAGER" || role === "DELIVERY_COORDINATOR";
}

export function isSpecialist(role: UserRole): boolean {
  return (
    role === "CASHIER" ||
    role === "INVENTORY_STAFF" ||
    role === "DELIVERY_COORDINATOR"
  );
}

export function requiresBranch(role: UserRole): boolean {
  return role === "BRANCH_MANAGER" || role === "CASHIER";
}

export function isAssignedCashierSale(
  identity: AccessIdentity | undefined,
  branch: Branch | undefined,
  customerId: string,
): boolean {
  return (
    isBranch(identity?.branch) &&
    (branch === undefined || branch === identity.branch) &&
    customerId === WALK_IN_CUSTOMER_ID
  );
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
  if (!requiresBranch(role)) return undefined;
  if (isBranch(identity?.branch)) return identity.branch;
  return role === "BRANCH_MANAGER" ? "Manila" : undefined;
}

export function ownAuditOnly(role: UserRole): boolean {
  return role === "MARKETING_CRM" || role === "BRANCH_MANAGER";
}
