import { createHash } from "node:crypto";
import type {
  SISRecord,
  LMSRecord,
  LibraryRecord,
  QualityIssue,
} from "@/shared/types";

export type QualityFinding = Pick<
  QualityIssue,
  | "id"
  | "rule"
  | "feed"
  | "sourceKey"
  | "studentId"
  | "description"
  | "severity"
>;
export function findQualityIssues(
  sis: SISRecord[],
  lms: LMSRecord[],
  library: LibraryRecord[],
): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const ids = new Set(sis.map((s) => s.studentId));
  const learning = new Set(lms.map((s) => s.studentId));
  const cards = new Set(library.map((s) => s.studentId));
  function add(
    rule: QualityFinding["rule"],
    feed: QualityFinding["feed"],
    key: string,
    studentId: string,
    description: string,
    severity: QualityFinding["severity"],
  ) {
    findings.push({
      id:
        "QI-" +
        createHash("sha256")
          .update(`${rule}|${feed}|${key}`)
          .digest("hex")
          .slice(0, 24),
      rule,
      feed,
      sourceKey: key,
      studentId,
      description,
      severity,
    });
  }
  for (const s of sis) {
    if (!learning.has(s.studentId))
      add(
        "MISSING_LMS",
        "LMS",
        s.studentId,
        s.studentId,
        "No learning record is linked to this SIS student. Confirm enrollment or supply the missing source record.",
        "Warning",
      );
    if (!cards.has(s.studentId))
      add(
        "MISSING_LIBRARY",
        "LIBRARY",
        s.studentId,
        s.studentId,
        "No library record is linked to this SIS student. Confirm the source or supply a clearance record.",
        "Warning",
      );
  }
  for (const row of lms)
    if (!ids.has(row.studentId))
      add(
        "ORPHAN_LMS",
        "LMS",
        `${row.studentId}:${row.courseCode}`,
        row.studentId,
        "This learning record has no matching SIS identity and is excluded from the published master.",
        "Error",
      );
  for (const row of library)
    if (!ids.has(row.studentId))
      add(
        "ORPHAN_LIBRARY",
        "LIBRARY",
        row.studentId,
        row.studentId,
        "This library record has no matching SIS identity and is excluded from the published master.",
        "Error",
      );
  return findings;
}
