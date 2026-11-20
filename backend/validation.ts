import { z } from "zod";
import Papa from "papaparse";
import type { Feed } from "@/shared/types";
import { DEPARTMENTS } from "@/shared/school";

const text = z.string().trim().min(1).max(200);
const upperText = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.string().min(1).max(200),
);
const id = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{1,60}$/,
    "Use letters, numbers, underscores or hyphens",
  );
const number = (max: number, integer = false, min = 0) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    integer
      ? z.number().int().min(min).max(max)
      : z.number().min(min).max(max),
  );
function normalizeIsoDate(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  const slashYmd = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (slashYmd) {
    return `${slashYmd[1]}-${slashYmd[2].padStart(2, "0")}-${slashYmd[3].padStart(2, "0")}`;
  }
  const slashMdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMdy) {
    return `${slashMdy[3]}-${slashMdy[1].padStart(2, "0")}-${slashMdy[2].padStart(2, "0")}`;
  }
  return trimmed;
}
function normalizeActivityDate(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return normalizeIsoDate(parts[0]);
  if (parts.length === 2) return `${normalizeIsoDate(parts[0])} ${parts[1]}`;
  return trimmed;
}
const date = z.preprocess(
  normalizeIsoDate,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "Enter a real date as YYYY-MM-DD",
    ),
);
const activityDate = z.preprocess(
  normalizeActivityDate,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(?: (?:[01]\d|2[0-3]):[0-5]\d)?$/)
    .refine(
      (value) => date.safeParse(value.slice(0, 10)).success,
      "Enter a real date as YYYY-MM-DD, optionally followed by HH:mm",
    ),
);
const departmentCode = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z.enum(DEPARTMENTS, {
    error: "Choose BSIT, BEED, BSED or BSHM",
  }),
);
export const schemas = {
  SIS: z
    .object({
      studentId: id,
      firstName: text,
      lastName: text,
      email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
      ssn: z.string().trim().regex(/^\d{3}-\d{2}-\d{4}$/),
      dateOfBirth: date,
      gender: text,
      major: text,
      department: departmentCode,
      yearLevel: z.enum([
        "Freshman",
        "Sophomore",
        "Junior",
        "Senior",
        "Graduate",
      ]),
      cumulativeGpa: number(5, false, 1),
      totalCredits: number(500, true),
      academicStanding: z.enum([
        "Dean's Lister",
        "Good Standing",
        "Academic Probation",
        "At-Risk",
      ]),
      financialAidStatus: z.enum([
        "Full Scholarship",
        "Need-Based Grant",
        "Student Loan",
        "Self-Funded",
      ]),
      advisorName: text,
      enrollmentStatus: z.enum([
        "Active",
        "Leave of Absence",
        "Graduated",
        "Suspended",
      ]),
    })
    .strict(),
  LMS: z
    .object({
      studentId: id,
      courseCode: upperText,
      courseName: text,
      attendancePercentage: number(100),
      assignmentsCompleted: number(1000, true),
      totalAssignments: number(1000, true),
      currentScorePercentage: number(100),
      letterGrade: upperText,
      lastActiveDate: activityDate,
      missedDeadlines: number(1000, true),
      riskIndicator: z.enum(["Low", "Moderate", "High"]),
    })
    .strict()
    .refine(
      (v) => v.assignmentsCompleted <= v.totalAssignments,
      "Completed assignments cannot exceed total assignments",
    ),
  LIBRARY: z
    .object({
      studentId: id,
      activeBorrows: number(1000, true),
      overdueCount: number(1000, true),
      outstandingFines: number(100000),
      borrowingHistoryCount: number(100000, true),
      clearanceStatus: z.enum(["Cleared", "Pending Return", "Hold Placed"]),
      facilityAccessLevel: z.enum(["Standard", "Graduate Lab", "Restricted"]),
    })
    .strict(),
  HR: z
    .object({
      facultyId: id,
      fullName: text,
      department: departmentCode,
      title: text,
      coursesTaught: text,
      employmentStatus: z.enum(["Full-Time", "Part-Time"]),
      payrollBand: text,
    })
    .strict(),
  ALUMNI: z
    .object({
      studentId: id,
      fullName: text,
      department: departmentCode,
      graduationYear: number(2100, true, 1950),
      degreeConferred: text,
      employmentStatus: z.enum(["Employed", "Graduate School", "Seeking"]),
      employer: text,
      contactConsent: z.enum(["Opted In", "Opted Out"]),
    })
    .strict(),
};

export function parseImport(
  feed: Feed,
  content: string,
  format: "csv" | "json",
) {
  let rows: unknown;
  if (format === "json") {
    try {
      rows = JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON. Upload an array of records.");
    }
  } else {
    const result = Papa.parse(content.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.length)
      throw new Error(`CSV could not be parsed: ${result.errors[0].message}`);
    rows = result.data;
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000)
    throw new Error("Upload between 1 and 1,000 records.");
  return rows.map((row, i) => {
    const result = schemas[feed].safeParse(row);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(
        `Row ${i + 1}, ${issue.path.join(".") || "record"}: ${issue.message}. No records were imported.`,
      );
    }
    return result.data;
  });
}
