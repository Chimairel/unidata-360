import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EDMSnapshot, UnifiedStudentRecord } from "@/shared/types";

export async function makeReport(
  data: EDMSnapshot,
  student?: UnifiedStudentRecord,
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(
    student
      ? `${student.studentId} - Student 360`
      : "UniData Academic Analytics",
  );
  pdf.setAuthor("UniData 360");
  let page = pdf.addPage([595.28, 841.89]);
  let y = 750;
  const clean = (v: unknown) =>
    String(v)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E\u2022]/g, "");
  const header = () => {
    page.drawRectangle({
      x: 0,
      y: 780,
      width: 596,
      height: 62,
      color: rgb(0.05, 0.09, 0.16),
    });
    page.drawText("UniData 360 | University data workspace", {
      x: 42,
      y: 805,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    });
  };
  header();
  function line(text: string, heading = false) {
    const font = heading ? bold : regular;
    const size = heading ? 13 : 10;
    const words = clean(text).split(/\s+/);
    let row = "";
    const lines: string[] = [];
    for (const word of words) {
      if (font.widthOfTextAtSize((row ? row + " " : "") + word, size) > 505) {
        if (row) lines.push(row);
        row = "";
      }
      if (font.widthOfTextAtSize(word, size) > 505) {
        for (const char of word) {
          if (font.widthOfTextAtSize(row + char, size) > 505) {
            lines.push(row);
            row = "";
          }
          row += char;
        }
      } else row += (row ? " " : "") + word;
    }
    if (row) lines.push(row);
    if (heading) y -= 12;
    for (const row of lines) {
      if (y < 68) {
        page = pdf.addPage([595.28, 841.89]);
        header();
        y = 750;
      }
      page.drawText(row, {
        x: 42,
        y,
        size,
        font,
        color: rgb(0.12, 0.18, 0.27),
      });
      y -= 17;
    }
    y -= 5;
  }
  line(student ? "Student 360 dossier" : "Academic analytics summary", true);
  line(`Generated: ${new Date().toISOString()} | Persona: ${data.currentRole}`);
  line(
    "Synthetic classroom demonstration data. Field permissions applied on the server.",
  );
  if (student) {
    line(`${student.fullName} | ${student.studentId}`, true);
    for (const [label, value] of Object.entries({
      Program: student.major,
      Department: student.department,
      "Year level": student.yearLevel,
      Email: student.email,
      SSN: student.ssn,
      "Date of birth": student.dateOfBirth,
      "Financial aid": student.financialAidStatus,
      Advisor: student.advisorName,
      "Enrollment status": student.enrollmentStatus,
      "Cumulative GPA": `${student.cumulativeGpa.toFixed(2)} / 4.00`,
      "Academic standing": student.academicStanding,
      Credits: student.totalCredits,
      "Risk classification": student.overallRiskCategory,
      "Data completeness": `${student.dataHealthScore}%`,
      "Last synchronized": student.lastSyncedAt,
    }))
      line(`${label}: ${value}`);
    line("Learning & campus resources", true);
    line(
      `Courses: ${student.lmsSummary.enrolledCoursesCount} | Attendance: ${student.lmsSummary.enrolledCoursesCount ? student.lmsSummary.averageAttendance + "%" : "No LMS data"} | Missed deadlines: ${student.lmsSummary.totalMissedDeadlines}`,
    );
    line(
      `Library clearance: ${student.librarySummary.clearanceStatus} | Outstanding fines: $${student.librarySummary.outstandingFines.toFixed(2)}`,
    );
    student.lmsSummary.courses.forEach((c) =>
      line(
        `${c.courseCode} - ${c.courseName}: ${c.currentScorePercentage}% (${c.letterGrade}); attendance ${c.attendancePercentage}%`,
      ),
    );
  } else {
    const students = data.masterRecords;
    const average = students.length
      ? students.reduce((n, s) => n + s.cumulativeGpa, 0) / students.length
      : 0;
    line("Cohort overview", true);
    line(
      `Students: ${students.length} | Average GPA: ${average.toFixed(2)} | Active enrollment: ${students.filter((s) => s.enrollmentStatus === "Active").length}`,
    );
    line(
      `Critical alerts: ${students.filter((s) => s.overallRiskCategory === "Critical Alert").length} | Library holds: ${students.filter((s) => s.librarySummary.clearanceStatus === "Hold Placed").length}`,
    );
    line(
      "Current enrollment is a snapshot, not a longitudinal retention rate. Risk is a rule-based classroom indicator, not a prediction or automated student decision.",
    );
    line("Student risk overview", true);
    students.forEach((s) =>
      line(
        `${s.fullName} (${s.studentId}) | ${s.major} | GPA ${s.cumulativeGpa.toFixed(2)} | ${s.overallRiskCategory}`,
      ),
    );
  }
  pdf.getPages().forEach((p, i) => {
    p.drawText(
      `UniData 360 | Educational demonstration | ${i + 1} / ${pdf.getPageCount()}`,
      { x: 42, y: 32, size: 8, font: regular, color: rgb(0.4, 0.45, 0.52) },
    );
  });
  return pdf.save();
}
