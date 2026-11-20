import {
  SISRecord,
  LMSRecord,
  LibraryRecord,
  HRRecord,
  AlumniRecord,
  UnifiedStudentRecord,
  ETLRunReport,
} from "@/shared/types";

export function standardizePersonName(value: string): string {
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return collapsed;
  const isAllUpper =
    collapsed === collapsed.toUpperCase() &&
    collapsed !== collapsed.toLowerCase();
  const isAllLower =
    collapsed === collapsed.toLowerCase() &&
    collapsed !== collapsed.toUpperCase();
  if (!isAllUpper && !isAllLower) return collapsed;
  return collapsed
    .toLowerCase()
    .replace(
      /(^|[\s\-'])([a-z])/g,
      (_, sep: string, char: string) => sep + char.toUpperCase(),
    );
}

export function runETLPipeline(
  sisData: SISRecord[],
  lmsData: LMSRecord[],
  libraryData: LibraryRecord[],
  options?: { timestamp?: string; id?: string },
  hrData: HRRecord[] = [],
  alumniData: AlumniRecord[] = [],
): { masterRecords: UnifiedStudentRecord[]; report: ETLRunReport } {
  const startTime = options?.timestamp || new Date().toISOString();
  const warnings: string[] = [];
  let anomaliesDetected = 0;
  let standardizedCount = 0;
  let failingNormalizedCount = 0;

  // Last record wins for repeated keys; upstream validation rejects invalid fields.
  const uniqueSIS = [
    ...new Map(
      sisData.map((s) => {
        const studentId = s.studentId.trim();
        const firstName = standardizePersonName(s.firstName);
        const lastName = standardizePersonName(s.lastName);
        const email = s.email.trim().toLowerCase();
        const department = s.department.trim().toUpperCase();
        // Philippine 1.00–5.00 grading rule: 1.00 highest, 3.00 or worse is a fail (instant 5.00).
        let cumulativeGpa = s.cumulativeGpa;
        if (cumulativeGpa >= 3.0 && cumulativeGpa < 5.0) {
          cumulativeGpa = 5.0;
          failingNormalizedCount++;
        }
        if (
          studentId !== s.studentId ||
          firstName !== s.firstName ||
          lastName !== s.lastName ||
          email !== s.email ||
          department !== s.department
        ) {
          standardizedCount++;
        }
        return [
          studentId,
          {
            ...s,
            studentId,
            firstName,
            lastName,
            email,
            department,
            cumulativeGpa,
          },
        ] as const;
      }),
    ).values(),
  ];
  const uniqueLMS = [
    ...new Map(
      lmsData.map((s) => {
        const studentId = s.studentId.trim();
        const courseCode = s.courseCode.trim().toUpperCase();
        const letterGrade = s.letterGrade.trim().toUpperCase();
        if (
          studentId !== s.studentId ||
          courseCode !== s.courseCode ||
          letterGrade !== s.letterGrade
        ) {
          standardizedCount++;
        }
        return [
          `${studentId}:${courseCode}`,
          { ...s, studentId, courseCode, letterGrade },
        ] as const;
      }),
    ).values(),
  ];
  if (standardizedCount > 0) {
    warnings.push(
      `[Transform]: Standardized ${standardizedCount} source record${standardizedCount === 1 ? "" : "s"} (name casing, whitespace, codes, or email).`,
    );
  }
  if (failingNormalizedCount > 0) {
    warnings.push(
      `[Business Rule]: Converted ${failingNormalizedCount} failing grade${failingNormalizedCount === 1 ? "" : "s"} (3.00 or worse → 5.00 fail).`,
    );
  }
  const studentIds = new Set(uniqueSIS.map((s) => s.studentId));
  const duplicateCount =
    sisData.length -
    uniqueSIS.length +
    lmsData.length -
    uniqueLMS.length +
    libraryData.length -
    new Set(libraryData.map((s) => s.studentId)).size;
  if (duplicateCount) {
    warnings.push(
      `Deduplicated ${duplicateCount} repeated source keys (last record wins).`,
    );
    anomaliesDetected += duplicateCount;
  }

  // Group LMS records by studentId
  const lmsByStudent = new Map<string, LMSRecord[]>();
  for (const lms of uniqueLMS) {
    if (!lms.studentId || !studentIds.has(lms.studentId)) {
      warnings.push(
        `[LMS Data Quality Warning]: Found unlinked course record "${lms.courseCode}". Dropped from pipeline.`,
      );
      anomaliesDetected++;
      continue;
    }
    const current = lmsByStudent.get(lms.studentId) || [];
    current.push(lms);
    lmsByStudent.set(lms.studentId, current);
  }

  // Group Library records by studentId
  const libraryByStudent = new Map<string, LibraryRecord>();
  for (const lib of libraryData) {
    if (!lib.studentId || !studentIds.has(lib.studentId)) {
      warnings.push(
        "[Library Quality Warning]: Found unlinked checkout entry. Dropped.",
      );
      anomaliesDetected++;
      continue;
    }
    libraryByStudent.set(lib.studentId, lib);
  }

  const hrByName = new Map<string, HRRecord>();
  for (const hr of hrData) {
    hrByName.set(hr.fullName.trim().toLowerCase(), hr);
  }

  const alumniByStudent = new Map<string, AlumniRecord>();
  for (const alumni of alumniData) {
    alumniByStudent.set(alumni.studentId.trim(), alumni);
  }

  const masterRecords: UnifiedStudentRecord[] = [];

  // Transform and Merge using SIS as primary golden demographic master
  for (const sis of uniqueSIS) {
    let presentSources = 1;

    // Check LMS reconciliation
    const studentLmsList = lmsByStudent.get(sis.studentId) || [];
    if (studentLmsList.length === 0) {
      warnings.push(
        `[Reconciliation Notice]: Student ${sis.studentId} has no active LMS course enrollment.`,
      );
    } else {
      presentSources++;
    }

    // Check Library reconciliation
    const studentLib = libraryByStudent.get(sis.studentId);
    if (!studentLib) {
      warnings.push(
        `[Reconciliation Notice]: Student ${sis.studentId} has no Library card record.`,
      );
    } else {
      presentSources++;
    }

    // Compute LMS summary statistics
    let totalAttendance = 0;
    let totalScore = 0;
    let totalMissed = 0;
    let highestRiskCourse: string | undefined = undefined;

    studentLmsList.forEach((course) => {
      totalAttendance += course.attendancePercentage;
      totalScore += course.currentScorePercentage;
      totalMissed += course.missedDeadlines;
      if (course.riskIndicator === "High" && !highestRiskCourse) {
        highestRiskCourse = `${course.courseCode} (${course.letterGrade})`;
      }
    });

    const avgAttendance =
      studentLmsList.length > 0
        ? Math.round(totalAttendance / studentLmsList.length)
        : 0;

    const avgLmsGrade =
      studentLmsList.length > 0
        ? Math.round(totalScore / studentLmsList.length)
        : 0;

    // Library summary
    const libSummary = studentLib
      ? {
          activeBorrows: studentLib.activeBorrows,
          overdueCount: studentLib.overdueCount,
          outstandingFines: studentLib.outstandingFines,
          clearanceStatus: studentLib.clearanceStatus,
        }
      : {
          activeBorrows: 0,
          overdueCount: 0,
          outstandingFines: 0,
          clearanceStatus: "Pending Return" as const,
        };

    // Calculate Comprehensive Risk Category (1.00 highest – 5.00 fail; >= 3.00 is failing)
    let overallRiskCategory: "Safe" | "Moderate Risk" | "Critical Alert" =
      "Safe";
    if (
      sis.cumulativeGpa >= 3.0 ||
      (studentLmsList.length > 0 && avgAttendance < 65) ||
      totalMissed >= 4 ||
      sis.academicStanding === "Academic Probation"
    ) {
      overallRiskCategory = "Critical Alert";
    } else if (
      sis.cumulativeGpa >= 2.5 ||
      (studentLmsList.length > 0 && avgAttendance < 80) ||
      totalMissed >= 2 ||
      libSummary.clearanceStatus === "Hold Placed"
    ) {
      overallRiskCategory = "Moderate Risk";
    }

    const matchedHr = hrByName.get(sis.advisorName.trim().toLowerCase());
    const matchedAlumni = alumniByStudent.get(sis.studentId);

    const unifiedStudent: UnifiedStudentRecord = {
      studentId: sis.studentId,
      fullName: `${sis.firstName} ${sis.lastName}`,
      email: sis.email,
      ssn: sis.ssn,
      dateOfBirth: sis.dateOfBirth,
      major: sis.major,
      department: sis.department,
      yearLevel: sis.yearLevel,
      cumulativeGpa: sis.cumulativeGpa,
      totalCredits: sis.totalCredits,
      academicStanding: sis.academicStanding,
      financialAidStatus: sis.financialAidStatus,
      advisorName: sis.advisorName,
      enrollmentStatus: sis.enrollmentStatus,
      lmsSummary: {
        enrolledCoursesCount: studentLmsList.length,
        averageAttendance: avgAttendance,
        averageLmsGrade: avgLmsGrade,
        totalMissedDeadlines: totalMissed,
        courses: studentLmsList,
        highestRiskCourse,
      },
      librarySummary: libSummary,
      ...(matchedHr
        ? {
            hrSummary: {
              facultyId: matchedHr.facultyId,
              facultyName: matchedHr.fullName,
              department: matchedHr.department,
              title: matchedHr.title,
              coursesTaught: matchedHr.coursesTaught,
              employmentStatus: matchedHr.employmentStatus,
              payrollBand: matchedHr.payrollBand,
            },
          }
        : {}),
      ...(matchedAlumni
        ? {
            alumniSummary: {
              graduationYear: matchedAlumni.graduationYear,
              degreeConferred: matchedAlumni.degreeConferred,
              employmentStatus: matchedAlumni.employmentStatus,
              employer: matchedAlumni.employer,
              contactConsent: matchedAlumni.contactConsent,
            },
          }
        : {}),
      dataHealthScore: Math.round((presentSources / 3) * 100),
      overallRiskCategory,
      lastSyncedAt: startTime,
    };

    masterRecords.push(unifiedStudent);
  }

  const endTime = options?.timestamp || new Date().toISOString();

  const report: ETLRunReport = {
    id: options?.id || `ETL-${crypto.randomUUID()}`,
    startTime,
    endTime,
    status: warnings.length > 0 ? "PARTIAL_SUCCESS" : "SUCCESS",
    recordsExtracted: {
      sis: sisData.length,
      lms: lmsData.length,
      library: libraryData.length,
      hr: hrData.length,
      alumni: alumniData.length,
    },
    recordsTransformed: masterRecords.length,
    recordsLoaded: masterRecords.length,
    anomaliesDetected,
    warnings,
  };

  return { masterRecords, report };
}
