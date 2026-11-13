import type {
  AccessIdentity,
  UnifiedStudentRecord,
  UserRole,
} from "@/shared/types";
import { isDepartment } from "@/shared/school";

export function departmentScope(role: UserRole, identity?: AccessIdentity) {
  if (role !== "DEAN") return undefined;
  return identity?.mode === "account" ? identity.department : "BSIT";
}

export function canAccessStudent(
  role: UserRole,
  identity: AccessIdentity | undefined,
  student: Pick<UnifiedStudentRecord, "studentId" | "department">,
) {
  if (role === "STUDENT")
    return (
      student.studentId ===
      (identity?.mode === "account" ? identity.studentId : "STU-2024-001")
    );
  if (role === "DEAN") {
    const scope = departmentScope(role, identity);
    return isDepartment(scope) && student.department === scope;
  }
  return true;
}

export const canImport = (role: UserRole) => role === "REGISTRAR";
export const canFollowUp = (role: UserRole) =>
  ["DEAN", "REGISTRAR", "ACADEMIC_ADVISOR"].includes(role);
export const canViewAnalytics = canFollowUp;
export const ownAuditOnly = (role: UserRole) =>
  role === "DEAN" || role === "ACADEMIC_ADVISOR";
