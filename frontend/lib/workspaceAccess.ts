import type { UserRole } from "@/shared/types";

export type TabId = "flow" | "checkout" | "stock" | "customers" | "sales";

const allTabs: readonly TabId[] = [
  "checkout",
  "stock",
  "customers",
  "sales",
  "flow",
];

const roleTabs: Record<UserRole, readonly TabId[]> = {
  OPS_MANAGER: allTabs,
  MARKETING_CRM: allTabs,
  BRANCH_MANAGER: allTabs,
  COMPLIANCE_AUDITOR: allTabs,
};

export function workspaceTabs(role: UserRole): readonly TabId[] {
  return roleTabs[role];
}

export function effectiveWorkspaceTab(role: UserRole, requested: TabId): TabId {
  const allowed = workspaceTabs(role);
  return allowed.includes(requested) ? requested : allowed[0];
}

export function defaultWorkspaceTab(role: UserRole): TabId {
  return workspaceTabs(role)[0];
}
