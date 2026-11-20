"use client";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { studentLifecycleSummary } from "@/frontend/lib/courseAlignment";
import { EmptyState, PageHeading, ReportLink, formatTime, Badge } from "./ui";

export function StudentWorkspace() {
  const { masterRecords, studentProfile } = useEDM();
  const student = masterRecords[0];
  if (!student)
    return studentProfile ? (
      <div className="page-stack">
        <PageHeading
          title={`Hello, ${studentProfile.fullName.split(" ")[0]}.`}
        />
        <section className="panel panel-body">
          <h2>Student account</h2>
          <p>
            {studentProfile.fullName} · {studentProfile.studentId} ·{" "}
            {studentProfile.department}
          </p>
          <p>Access approved. Academic records have not been imported yet.</p>
          <p className="small muted">
            Contact the registrar for your school record.
          </p>
        </section>
      </div>
    ) : (
      <EmptyState title="Your record is not available">
        Contact the registrar to check your linked student ID.
      </EmptyState>
    );
  const courses = student.lmsSummary.courses;
  return (
    <div className="page-stack">
      <PageHeading
        title={`Hello, ${student.fullName.split(" ")[0]}.`}
        action={
          <ReportLink
            kind="student"
            studentId={student.studentId}
            label="Download my report"
          />
        }
      />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>My student record</h2>
            <p>
              {student.fullName} · {student.studentId}
            </p>
          </div>
          <Badge>{student.enrollmentStatus}</Badge>
        </div>
        <div className="panel-body">
          <dl className="detail-fields">
            {Object.entries({
              Program: student.major,
              Department: student.department,
              "Year level": student.yearLevel,
              "University email": student.email,
              "Academic advisor": student.advisorName,
              ...(student.hrSummary
                ? {
                    "Advisor role (HR)": `${student.hrSummary.title} · ${student.hrSummary.coursesTaught}`,
                  }
                : {}),
              "Academic standing": student.academicStanding,
              "Cumulative GWA": `${student.cumulativeGpa.toFixed(2)}${student.cumulativeGpa >= 3 ? " (Fail)" : " (1.00–5.00)"}`,
              "Completed credits": student.totalCredits,
              "Lifecycle stage": studentLifecycleSummary(student).stage,
              "Graduation review":
                studentLifecycleSummary(student).graduationContext,
              ...(student.alumniSummary
                ? {
                    "Alumni CRM": `Class of ${student.alumniSummary.graduationYear} · ${student.alumniSummary.employmentStatus} · GDPR ${student.alumniSummary.contactConsent}`,
                  }
                : {}),
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <div className="split-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>My learning activity</h2>
            </div>
          </div>
          {courses.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Score</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.courseCode}>
                      <td>
                        {course.courseCode}
                        <span className="muted">{course.courseName}</span>
                      </td>
                      <td>{course.currentScorePercentage}%</td>
                      <td>{course.attendancePercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel-body">
              <p>No learning records yet.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>My library clearance</h2>
            </div>
          </div>
          <div className="panel-body">
            <dl className="detail-fields">
              {Object.entries({
                "Clearance status": student.librarySummary.clearanceStatus,
                "Active loans": student.librarySummary.activeBorrows,
                "Overdue items": student.librarySummary.overdueCount,
                "Outstanding fines":
                  student.librarySummary.outstandingFines.toFixed(2),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
      <div className="inline-note">
        Updated {formatTime(student.lastSyncedAt)}. For corrections, contact the
        registrar.
      </div>
    </div>
  );
}
