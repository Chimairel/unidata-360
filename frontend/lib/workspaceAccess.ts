import type { UserRole } from "@/shared/types";

export type TabId =
  | "accounts"
  | "pipeline"
  | "student360"
  | "analytics"
  | "governance"
  | "quality"
  | "cases";

const roleTabs: Record<UserRole, readonly TabId[]> = {
  SYSTEM_ADMIN: ["accounts"],
  REGISTRAR: [
    "student360",
    "pipeline",
    "quality",
    "cases",
    "analytics",
    "governance",
  ],
  DEAN: ["analytics", "student360", "cases", "governance"],
  ACADEMIC_ADVISOR: ["student360", "cases", "analytics", "governance"],
  STUDENT: ["student360"],
  COMPLIANCE_AUDITOR: ["governance", "quality", "student360"],
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
