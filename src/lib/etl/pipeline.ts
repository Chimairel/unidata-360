import {
  SISRecord,
  LMSRecord,
  LibraryRecord,
  UnifiedStudentRecord,
  ETLRunReport,
} from "../types";

export function runETLPipeline(
  sisData: SISRecord[],
  lmsData: LMSRecord[],
  libraryData: LibraryRecord[],
  options?: { timestamp?: string; id?: string },
): { masterRecords: UnifiedStudentRecord[]; report: ETLRunReport } {
  const startTime = options?.timestamp || new Date().toISOString();
  const warnings: string[] = [];
  let anomaliesDetected = 0;

  // Last record wins for repeated keys; upstream validation rejects invalid fields.
  const uniqueSIS = [
    ...new Map(
      sisData.map((s) => [
        s.studentId.trim(),
        {
          ...s,
          studentId: s.studentId.trim(),
          firstName: s.firstName.trim(),
          lastName: s.lastName.trim(),
          email: s.email.trim().toLowerCase(),
        },
      ]),
    ).values(),
  ];
  const uniqueLMS = [
    ...new Map(
      lmsData.map((s) => [`${s.studentId}:${s.courseCode}`, s]),
    ).values(),
  ];
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

  const masterRecords: UnifiedStudentRecord[] = [];

  // Transform and Merge using SIS as primary golden demographic master
  for (const sis of uniqueSIS) {
    let healthScore = 100;

    // Check LMS reconciliation
    const studentLmsList = lmsByStudent.get(sis.studentId) || [];
    if (studentLmsList.length === 0) {
      warnings.push(
        `[Reconciliation Notice]: Student ${sis.studentId} has no active LMS course enrollment.`,
      );
      healthScore -= 20;
    }

    // Check Library reconciliation
    const studentLib = libraryByStudent.get(sis.studentId);
    if (!studentLib) {
      warnings.push(
        `[Reconciliation Notice]: Student ${sis.studentId} has no Library card record.`,
      );
      healthScore -= 10;
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

    // Calculate Comprehensive Risk Category
    let overallRiskCategory: "Safe" | "Moderate Risk" | "Critical Alert" =
      "Safe";
    if (
      sis.cumulativeGpa < 2.0 ||
      (studentLmsList.length > 0 && avgAttendance < 65) ||
      totalMissed >= 4 ||
      sis.academicStanding === "Academic Probation"
    ) {
      overallRiskCategory = "Critical Alert";
    } else if (
      sis.cumulativeGpa < 2.5 ||
      (studentLmsList.length > 0 && avgAttendance < 80) ||
      totalMissed >= 2 ||
      libSummary.clearanceStatus === "Hold Placed"
    ) {
      overallRiskCategory = "Moderate Risk";
    }

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
      dataHealthScore: Math.max(0, healthScore),
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
    status: anomaliesDetected > 0 ? "PARTIAL_SUCCESS" : "SUCCESS",
    recordsExtracted: {
      sis: sisData.length,
      lms: lmsData.length,
      library: libraryData.length,
    },
    recordsTransformed: masterRecords.length,
    recordsLoaded: masterRecords.length,
    anomaliesDetected,
    warnings,
  };

  return { masterRecords, report };
}
