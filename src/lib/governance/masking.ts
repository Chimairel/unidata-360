import { UserRole, UnifiedStudentRecord, AuditLogEntry } from "../types";

export function applyFERPAMasking(
  student: UnifiedStudentRecord,
  role: UserRole,
): UnifiedStudentRecord {
  // Classroom application policy: registrar persona receives full demonstration fields.
  if (role === "DEAN_REGISTRAR") {
    return { ...student };
  }

  // Academic Advisor: Allowed to see academic performance, but PII & financial data are protected under FERPA
  if (role === "ACADEMIC_ADVISOR") {
    return {
      ...student,
      ssn: maskSSN(student.ssn),
      dateOfBirth: "••••-••-••",
      financialAidStatus: "[FERPA Masked: Financial Need Restricted]",
    };
  }

  // Compliance Auditor: Focuses on governance & metadata, masking PII
  if (role === "COMPLIANCE_AUDITOR") {
    return {
      ...student,
      ssn: "•••-••-••••",
      email: maskEmail(student.email),
      financialAidStatus: "[Restricted Compliance Audit Mode]",
      fullName: `Student ${student.studentId.slice(-3)}`,
      dateOfBirth: "Restricted",
      advisorName: "Restricted",
      lmsSummary: { ...student.lmsSummary, courses: [] },
    };
  }

  // Student: Student viewing their own record
  return {
    ...student,
    ssn: maskSSN(student.ssn),
    financialAidStatus: "Restricted in student demonstration",
  };
}

export function maskSSN(ssn: string): string {
  if (!ssn || ssn.length < 4) return "•••-••-••••";
  const lastFour = ssn.slice(-4);
  return `•••-••-${lastFour}`;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "••••••@••••";
  const [username, domain] = email.split("@");
  if (username.length <= 2) return `${username[0]}*@${domain}`;
  return `${username.slice(0, 2)}${"*".repeat(username.length - 2)}@${domain}`;
}

export function createAuditLog(
  userRole: UserRole,
  actorName: string,
  action: AuditLogEntry["action"],
  targetResource: string,
  details: string,
  status: AuditLogEntry["status"] = "ALLOWED",
  overrideTimestamp?: string,
  overrideId?: string,
): AuditLogEntry {
  return {
    id: overrideId || `AUDIT-${crypto.randomUUID()}`,
    timestamp: overrideTimestamp || new Date().toISOString(),
    userRole,
    actorName,
    action,
    targetResource,
    status,
    details,
  };
}
