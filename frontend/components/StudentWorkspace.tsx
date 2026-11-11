"use client";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { EmptyState, PageHeading, ReportLink, formatTime, Badge } from "./ui";

export function StudentWorkspace() {
  const { masterRecords } = useEDM();
  const student = masterRecords[0];
  if (!student)
    return (
      <EmptyState title="Your record is not available">
        Ask the registrar to check the student ID linked to your account and
        refresh your record.
      </EmptyState>
    );
  const courses = student.lmsSummary.courses;
  return (
    <div className="page-stack">
      <PageHeading
        title={`Hello, ${student.fullName.split(" ")[0]}.`}
        description="Your academic record, learning activity, and library clearance in one place."
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
              "Academic standing": student.academicStanding,
              "Cumulative GPA": `${student.cumulativeGpa.toFixed(2)} / 4.00`,
              "Completed credits": student.totalCredits,
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
              <p>Course results and attendance from the learning system</p>
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
              <p>No learning activity has been imported for your record yet.</p>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>My library clearance</h2>
              <p>Loans, overdue items, and outstanding fines</p>
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
            <p className="small muted">
              For questions about loans or clearance, contact the university
              library.
            </p>
          </div>
        </section>
      </div>
      <div className="inline-note">
        This account can view and download only its linked student record. To
        correct university data, contact the registrar. Last refreshed:{" "}
        {formatTime(student.lastSyncedAt)}.
      </div>
    </div>
  );
}
