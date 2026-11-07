// Classroom reference: integration.pptx, slides 3–13 and 17–19.
// Implementation scope is explicit so modeled systems are never presented as live connectors.
export const educationSourceMap = [
  {
    source: "Student Information System",
    owner: "Registrar",
    data: "Identity, enrollment, program, GPA, credits and academic standing",
    integration: "CSV/JSON API ingestion; studentId master key",
    governance:
      "Registrar controls imports; server masks protected fields by role",
    output: "Student 360 and academic analytics",
    status: "Implemented",
  },
  {
    source: "Learning Management System",
    owner: "Academic departments",
    data: "Courses, attendance, assignments, scores and last activity",
    integration: "CSV/JSON API ingestion; studentId + courseCode upsert",
    governance:
      "Validate scores and dates; withhold raw feeds from non-registrars",
    output: "Engagement summaries and explainable warning signals",
    status: "Implemented",
  },
  {
    source: "HR and payroll",
    owner: "Human Resources",
    data: "Faculty and staff identity, appointments and teaching assignments",
    integration: "Proposed authenticated vendor API or controlled batch export",
    governance:
      "Separate employee/payroll permissions and retention policy required",
    output: "Faculty and advising context in the wider university model",
    status: "Modeled extension",
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
    data: "Graduate identity, graduation year, engagement and contact preferences",
    integration:
      "Proposed studentId-to-alumni identity mapping and controlled API",
    governance:
      "Purpose limitation, contact preferences and access policy required",
    output: "Post-graduation engagement in the wider lifecycle model",
    status: "Modeled extension",
  },
] as const;

export const educationLifecycle = [
  {
    stage: "Enrollment",
    evidence: "SIS identity, enrollment status, program and credits",
    status: "Implemented",
  },
  {
    stage: "Learning",
    evidence: "LMS engagement joined to GPA, with human-reviewed warning rules",
    status: "Implemented",
  },
  {
    stage: "Graduation",
    evidence:
      "Credits, enrollment status and library clearance support review; degree eligibility is not automated",
    status: "Review context",
  },
  {
    stage: "Alumni",
    evidence:
      "Alumni CRM and identity handoff are mapped; no alumni connector is deployed",
    status: "Modeled extension",
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
    evidence: "Course alignment view, pipeline flow and classroom slides",
  },
  {
    id: "COURSE-03",
    slide: 19,
    requirement: "Share a flowchart",
    evidence: "Four-stage pipeline flow and lifecycle presentation",
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
      "Enrollment-to-alumni scope map, vendor boundaries and secure role projections",
  },
  {
    id: "COURSE-06",
    slide: 3,
    requirement: "Relate integration, governance and DQM",
    evidence:
      "Validated ingestion, reconciled master, field permissions and audit integrity",
  },
] as const;
