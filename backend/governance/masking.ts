import { UserRole, UnifiedStudentRecord, AuditLogEntry } from "@/shared/types";

export function applyFERPAMasking(
  student: UnifiedStudentRecord,
  role: UserRole,
): UnifiedStudentRecord {
  // Classroom application policy: registrar persona receives full demonstration fields.
  if (role === "REGISTRAR") {
    return { ...student };
  }

  // Academic Advisor & Dean: Allowed to see academic performance, but PII, financial aid & payroll are masked
  if (role === "ACADEMIC_ADVISOR" || role === "DEAN") {
    return {
      ...student,
      ssn: maskSSN(student.ssn),
      dateOfBirth: "••••-••-••",
      financialAidStatus: "[FERPA Masked: Financial Need Restricted]",
      ...(student.hrSummary
        ? {
            hrSummary: {
              ...student.hrSummary,
              payrollBand: "[HR Payroll Restricted]",
            },
          }
        : {}),
      ...(student.alumniSummary
        ? {
            alumniSummary: {
              ...student.alumniSummary,
              employer:
                student.alumniSummary.contactConsent === "Opted Out"
                  ? "[GDPR Opted Out]"
                  : student.alumniSummary.employer,
            },
          }
        : {}),
    };
  }

  // Compliance Auditor: Focuses on governance & metadata, masking PII & HR details
  if (role === "COMPLIANCE_AUDITOR") {
    return {
      ...student,
      ssn: "•••-••-••••",
      email: maskEmail(student.email),
      financialAidStatus: "[Restricted Compliance Audit Mode]",
      fullName: `Student ${student.studentId.slice(-3)}`,
      dateOfBirth: "Restricted",
      advisorName: "Restricted",
      hrSummary: undefined,
      ...(student.alumniSummary
        ? {
            alumniSummary: {
              ...student.alumniSummary,
              employer: "[Restricted]",
            },
          }
        : {}),
      lmsSummary: { ...student.lmsSummary, courses: [] },
    };
  }

  // Student: Student viewing their own record
  if (role === "STUDENT") {
    return {
      ...student,
      ssn: maskSSN(student.ssn),
      financialAidStatus: "Restricted in student demonstration",
      ...(student.hrSummary
        ? {
            hrSummary: {
              ...student.hrSummary,
              payrollBand: "[HR Payroll Restricted]",
            },
          }
        : {}),
    };
  }

  // Fail closed for any other role (e.g., SYSTEM_ADMIN should never receive student records)
  return {
    ...student,
    ssn: "•••-••-••••",
    email: maskEmail(student.email),
    financialAidStatus: "[Restricted]",
    fullName: `Student ${student.studentId.slice(-3)}`,
    dateOfBirth: "Restricted",
    advisorName: "Restricted",
    hrSummary: undefined,
    ...(student.alumniSummary
      ? {
          alumniSummary: {
            ...student.alumniSummary,
            employer: "[Restricted]",
          },
        }
      : {}),
    lmsSummary: { ...student.lmsSummary, courses: [] },
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
