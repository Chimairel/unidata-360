import type { UnifiedStudentRecord } from "@/shared/types";

// Classroom reference: integration.pptx, slides 3–13 and 17–19.
export function studentLifecycleSummary(student: UnifiedStudentRecord): {
  stage: string;
  graduationContext: string;
} {
  if (student.enrollmentStatus === "Graduated") {
    if (student.alumniSummary) {
      return {
        stage: "Alumni (Graduated)",
        graduationContext: `Class of ${student.alumniSummary.graduationYear} · ${student.alumniSummary.employmentStatus} · GDPR ${student.alumniSummary.contactConsent}`,
      };
    }
    return {
      stage: "Graduated · Alumni CRM pending",
      graduationContext:
        student.librarySummary.clearanceStatus === "Cleared"
          ? "Graduated · Library cleared"
          : `Graduated · Library ${student.librarySummary.clearanceStatus.toLowerCase()}`,
    };
  }
  const senior =
    student.yearLevel === "Senior" || student.yearLevel === "Graduate";
  const stage = senior
    ? "Graduation review"
    : student.lmsSummary.enrolledCoursesCount > 0
      ? "Learning"
      : "Enrollment";
  const blockers: string[] = [];
  if (
    student.academicStanding === "Academic Probation" ||
    student.academicStanding === "At-Risk"
  ) {
    blockers.push(student.academicStanding);
  }
  if (student.librarySummary.clearanceStatus !== "Cleared") {
    blockers.push(`Library: ${student.librarySummary.clearanceStatus}`);
  }
  if (!senior) {
    return {
      stage,
      graduationContext: blockers.length
        ? `${student.totalCredits} credits · ${blockers.join(" · ")}`
        : `${student.totalCredits} credits · On track`,
    };
  }
  return {
    stage,
    graduationContext: blockers.length
      ? `Review required (${blockers.join("; ")})`
      : `${student.totalCredits} credits · Standing & library clear for Registrar review`,
  };
}

export const educationSourceMap = [
  {
    source: "Student Information System",
    owner: "Registrar",
    data: "Identity, enrollment, program, GWA (1.00–5.00), credits and standing",
    integration:
      "CSV/JSON API ingestion; name/date/code cleansing; studentId master key",
    governance:
      "Registrar controls imports and student activation; server masks protected fields by role",
    output: "Student 360, graduation workflow and academic analytics",
    status: "Implemented",
  },
  {
    source: "Learning Management System",
    owner: "Academic departments",
    data: "Courses, attendance, assignments, scores and last activity",
    integration:
      "CSV/JSON API ingestion; date/code standardization; studentId + courseCode upsert",
    governance:
      "Validate scores and dates; withhold raw feeds from non-registrars",
    output: "Engagement summaries, warning signals and Advising Cases",
    status: "Implemented",
  },
  {
    source: "HR and payroll",
    owner: "Human Resources",
    data: "Faculty advisor identity, titles, courses taught and payroll band",
    integration:
      "CSV/JSON API ingestion; reconciled by advisor name into Student 360",
    governance:
      "Payroll bands masked ([HR Payroll Restricted]) for all non-Registrar roles",
    output: "Faculty advisor and course-load context inside Student 360",
    status: "Implemented",
  },
  {
    source: "Library",
    owner: "Library services",
    data: "Loans, overdue items, fines and clearance status",
    integration: "CSV/JSON API ingestion; studentId reconciliation",
    governance: "Validate counts and fines; registrar-only raw records",
    output: "Campus clearance context for graduation review",
    status: "Implemented",
  },
  {
    source: "Alumni CRM",
    owner: "Alumni relations",
    data: "Graduate identity, class year, employment and GDPR contact consent",
    integration:
      "CSV/JSON API ingestion + Registrar Graduation handoff into Alumni CRM",
    governance:
      "Respects Opted In / Opted Out GDPR preferences (masks opted-out employer)",
    output: "Live post-graduation Alumni CRM directory and lifecycle handoff",
    status: "Implemented",
  },
] as const;

export const educationLifecycle = [
  {
    stage: "Enrollment",
    evidence:
      "SIS identity (YYYYMMDD), enrollment, program, credits, and mandatory 123456 student onboarding",
    status: "Implemented",
  },
  {
    stage: "Learning",
    evidence:
      "LMS engagement joined to GWA (1.00–5.00; 3.00+ = fail/5.00), HR faculty advisors, and Advising Cases",
    status: "Implemented",
  },
  {
    stage: "Graduation",
    evidence:
      "Credits, academic standing, Library clearance, and Registrar one-click Graduate -> Alumni CRM handoff",
    status: "Implemented",
  },
  {
    stage: "Alumni",
    evidence:
      "Live Alumni CRM feed tracking graduation year, placement, and GDPR Opted In / Opted Out consent",
    status: "Implemented",
  },
] as const;

export const courseRequirements = [
  {
    id: "COURSE-01",
    slide: 19,
    requirement: "Choose one industry",
    evidence:
      "Education / Universities throughout the workspace and presentation",
  },
  {
    id: "COURSE-02",
    slide: 19,
    requirement: "Map sources, integration, governance and outputs",
    evidence:
      "All 5 feeds (SIS, LMS, Library, HR/Payroll, Alumni CRM) live in pipeline and flowchart",
  },
  {
    id: "COURSE-03",
    slide: 19,
    requirement: "Share a flowchart",
    evidence: "Four-stage pipeline flow and interactive lifecycle diagram",
  },
  {
    id: "COURSE-04",
    slide: 18,
    requirement: "Place the industry in a comparative matrix",
    evidence: "Five-industry matrix, including the complete Education row",
  },
  {
    id: "COURSE-05",
    slide: 17,
    requirement: "Explain the university lifecycle and its challenges",
    evidence:
      "Live Enrollment -> Learning -> Graduation -> Alumni lifecycle, vendor feeds, and secure access",
  },
  {
    id: "COURSE-06",
    slide: 3,
    requirement: "Relate integration, governance and DQM",
    evidence:
      "Validated ingestion, reconciled master, field/payroll masking and audit integrity",
  },
] as const;
