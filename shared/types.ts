import type { Department } from "./school";

export type UserRole =
  "REGISTRAR" | "DEAN" | "ACADEMIC_ADVISOR" | "STUDENT" | "COMPLIANCE_AUDITOR";

// 1. DATA SOURCE: Student Information System (SIS)
export interface SISRecord {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  ssn: string; // Sensitive PII
  dateOfBirth: string;
  gender: string;
  major: string;
  department: string;
  yearLevel: "Freshman" | "Sophomore" | "Junior" | "Senior" | "Graduate";
  cumulativeGpa: number;
  totalCredits: number;
  academicStanding:
    "Dean's Lister" | "Good Standing" | "Academic Probation" | "At-Risk";
  financialAidStatus:
    "Full Scholarship" | "Need-Based Grant" | "Student Loan" | "Self-Funded";
  advisorName: string;
  enrollmentStatus: "Active" | "Leave of Absence" | "Graduated" | "Suspended";
}

// 2. DATA SOURCE: Learning Management System (LMS - Canvas / Blackboard)
export interface LMSRecord {
  studentId: string;
  courseCode: string;
  courseName: string;
  attendancePercentage: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  currentScorePercentage: number;
  letterGrade: string;
  lastActiveDate: string;
  missedDeadlines: number;
  riskIndicator: "Low" | "Moderate" | "High";
}

// 3. DATA SOURCE: Library & Campus Resources
export interface LibraryRecord {
  studentId: string;
  activeBorrows: number;
  overdueCount: number;
  outstandingFines: number; // in USD
  borrowingHistoryCount: number;
  clearanceStatus: "Cleared" | "Pending Return" | "Hold Placed";
  facilityAccessLevel: "Standard" | "Graduate Lab" | "Restricted";
}

// 4. UNIFIED 360 MASTER RECORD (Output of EDM Integration)
export interface UnifiedStudentRecord {
  studentId: string;
  fullName: string;
  maskedName?: string;
  email: string;
  maskedEmail?: string;
  ssn: string; // masked depending on role
  dateOfBirth: string;
  major: string;
  department: string;
  yearLevel: string;
  cumulativeGpa: number;
  totalCredits: number;
  academicStanding: string;
  financialAidStatus: string;
  advisorName: string;
  enrollmentStatus: string;

  // Enriched LMS Insights
  lmsSummary: {
    enrolledCoursesCount: number;
    averageAttendance: number;
    averageLmsGrade: number;
    totalMissedDeadlines: number;
    courses: LMSRecord[];
    highestRiskCourse?: string;
  };

  // Enriched Library & Clearance Insights
  librarySummary: {
    activeBorrows: number;
    overdueCount: number;
    outstandingFines: number;
    clearanceStatus: "Cleared" | "Pending Return" | "Hold Placed";
  };

  // EDM Data Quality & Health Score
  dataHealthScore: number; // 0 - 100%
  overallRiskCategory: "Safe" | "Moderate Risk" | "Critical Alert";
  lastSyncedAt: string;
}

// GOVERNANCE & AUDIT LOGGING (FERPA / GDPR)
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userRole: UserRole | "DEAN_REGISTRAR"; // Historical audit entries remain unchanged.
  actorName: string;
  action:
    | "READ_STUDENT_360"
    | "ETL_SYNC_RUN"
    | "EXPORT_DATA"
    | "MASKING_OVERRIDE_ATTEMPT"
    | "GDPR_CONSENT_CHECK"
    | "IMPORT_DATA"
    | "CREATE_INTERVENTION"
    | "RESET_DEMO"
    | "SIGN_IN"
    | "SIGN_OUT"
    | "STUDENT_REGISTERED"
    | "PASSWORD_RESET";
  targetResource: string;
  status: "ALLOWED" | "RESTRICTED_MASKED" | "LOGGED";
  details: string;
  hash?: string;
  actorId?: string;
}

export interface AccessIdentity {
  mode: "demo" | "account";
  userId?: string;
  displayName?: string;
  studentId?: string;
  department?: Department;
}

export type Feed = "SIS" | "LMS" | "LIBRARY";
export interface Intervention {
  id: string;
  studentId: string;
  advisorName: string;
  createdAt: string;
  status: "Open" | "Resolved";
}
export interface EDMSnapshot {
  accessMode?: "demo" | "account";
  currentRole: UserRole;
  actorName: string;
  departmentScope?: Department;
  sisRecords: SISRecord[];
  lmsRecords: LMSRecord[];
  libraryRecords: LibraryRecord[];
  masterRecords: UnifiedStudentRecord[];
  etlReports: ETLRunReport[];
  auditLogs: AuditLogEntry[];
  interventions: Intervention[];
  sourceCounts: Record<Feed, number>;
  auditIntegrity: boolean;
}

// ETL Pipeline Execution Metrics
export interface ETLRunReport {
  id: string;
  startTime: string;
  endTime: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  recordsExtracted: {
    sis: number;
    lms: number;
    library: number;
  };
  recordsTransformed: number;
  recordsLoaded: number;
  anomaliesDetected: number;
  warnings: string[];
}
