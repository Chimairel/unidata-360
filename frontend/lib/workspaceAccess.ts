import type { UserRole } from "@/shared/types";

export type TabId = "pipeline" | "student360" | "analytics" | "governance";

const roleTabs: Record<UserRole, readonly TabId[]> = {
  REGISTRAR: ["student360", "pipeline", "analytics", "governance"],
  DEAN: ["analytics", "student360", "governance"],
  ACADEMIC_ADVISOR: ["student360", "analytics", "governance"],
  STUDENT: ["student360"],
  COMPLIANCE_AUDITOR: ["governance", "student360"],
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
