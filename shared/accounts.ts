import type { AuditLogEntry, UserRole } from "./types";

export const STAFF_ROLES = [
  "REGISTRAR",
  "DEAN",
  "ACADEMIC_ADVISOR",
  "COMPLIANCE_AUDITOR",
] as const;
export const ROLE_LABELS: Record<UserRole, string> = {
  SYSTEM_ADMIN: "System Admin",
  REGISTRAR: "Registrar",
  DEAN: "Dean",
  ACADEMIC_ADVISOR: "Academic Advisor",
  STUDENT: "Student",
  COMPLIANCE_AUDITOR: "Compliance Auditor",
};
export const ACCOUNT_ACTIONS = [
  "ACCOUNT_CREATED",
  "ACCOUNT_UPDATED",
  "ACCOUNT_STATUS_CHANGED",
  "STAFF_PASSWORD_RESET",
] as const;

export function isAdminAuditEntry(entry: AuditLogEntry) {
  return (
    (ACCOUNT_ACTIONS as readonly string[]).includes(entry.action) ||
    (entry.userRole === "SYSTEM_ADMIN" &&
      ["SIGN_IN", "SIGN_OUT", "MASKING_OVERRIDE_ATTEMPT"].includes(
        entry.action,
      ))
  );
}
