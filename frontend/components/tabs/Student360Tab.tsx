"use client";
import { useState } from "react";
import { CohortInsights } from "@/frontend/components/CohortInsights";
import { StudentDirectory } from "@/frontend/components/StudentDirectory";
import {
  ShieldCheck,
  LockKeyhole,
  Users,
  GraduationCap,
  ArrowUpRight,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import {
  Badge,
  formatTime,
  Modal,
  ReportLink,
  RiskBadge,
} from "@/frontend/components/ui";

export function Student360Tab() {
  const {
    masterRecords,
    currentRole,
    viewStudent,
    isSyncing,
    accessMode,
    actorName,
  } = useEDM();
  const [risk, setRisk] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = masterRecords.find((s) => s.studentId === selectedId);
  const completeness = masterRecords.length
    ? Math.round(
        masterRecords.reduce((n, s) => n + s.dataHealthScore, 0) /
          masterRecords.length,
      )
    : 0;
  return (
    <div className="page-stack">
      <div className="student-dashboard">
        <div className="student-dashboard-main">
          <section className="welcome-banner">
            <div>
              <h1>
                Hello,{" "}
                {currentRole === "STUDENT"
                  ? masterRecords[0]?.fullName.split(" ")[0] || "there"
                  : actorName.split(" ").find((n) => !n.includes(".")) ||
                    "there"}
                !
              </h1>
              <p>It’s good to see your university connected.</p>
              <span>Student lifecycle workspace</span>
            </div>
            <div className="welcome-emblem" aria-hidden="true">
              <GraduationCap size={84} strokeWidth={1.2} />
              <span className="emblem-tag tag-sis">SIS</span>
              <span className="emblem-tag tag-lms">LMS</span>
              <span className="emblem-tag tag-library">Library</span>
            </div>
          </section>
          <div className="connected-record-strip">
            <span className="record-strip-icon">
              <ShieldCheck size={23} />
            </span>
            <div>
              <strong>One student. The whole story.</strong>
              <span>
                {completeness}% source completeness · SIS + LMS + Library
              </span>
            </div>
            <Badge tone="info">
              {currentRole === "DEAN_REGISTRAR"
                ? "Registrar access"
                : "Server-masked access"}
            </Badge>
            <ArrowUpRight size={20} />
          </div>
          <StudentDirectory
            students={masterRecords}
            risk={risk}
            setRisk={setRisk}
            busy={isSyncing}
            onOpen={async (id) => {
              if (await viewStudent(id)) setSelectedId(id);
            }}
          />
        </div>
        <CohortInsights
          onAttention={() => {
            setRisk(risk === "attention" ? "ALL" : "attention");
            document
              .getElementById("student-directory")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onOpen={async (id) => {
            if (await viewStudent(id)) setSelectedId(id);
          }}
        />
      </div>
      <div className="inline-note">
        <LockKeyhole size={15} />
        <span>
          Field permissions are applied by the server.{" "}
          {currentRole === "STUDENT"
            ? accessMode === "account"
              ? "You can only access the student record linked to your account."
              : "You can only access the Marcus Vance demonstration record."
            : currentRole === "COMPLIANCE_AUDITOR"
              ? "Auditor profiles use pseudonyms; direct course details and sensitive fields are withheld."
              : "Open a dossier to inspect the source history and download a role-scoped report."}
        </span>
      </div>
      {selected && (
        <Modal
          title="Student 360 dossier"
          wide
          onClose={() => setSelectedId(null)}
        >
          <div className="modal-body">
            <div className="detail-top">
              <div className="student-identity">
                <span className="avatar">
                  <Users size={20} />
                </span>
                <div>
                  <h2>{selected.fullName}</h2>
                  <span className="muted small">
                    {selected.studentId} · {selected.major}
                  </span>
                </div>
              </div>
              <div className="heading-actions">
                <RiskBadge risk={selected.overallRiskCategory} />
                <ReportLink kind="student" studentId={selected.studentId} />
                <ReportLink
                  kind="json"
                  studentId={selected.studentId}
                  label="Export JSON"
                />
              </div>
            </div>
            <div className="detail-grid">
              <section>
                <h3>Academic & personal record</h3>
                <dl className="detail-fields">
                  {Object.entries({
                    Email: selected.email,
                    "Year level": selected.yearLevel,
                    "Cumulative GPA": `${selected.cumulativeGpa.toFixed(2)} / 4.00`,
                    "Total credits": selected.totalCredits,
                    "Academic standing": selected.academicStanding,
                    Enrollment: selected.enrollmentStatus,
                    Advisor: selected.advisorName,
                    SSN: selected.ssn,
                    "Date of birth": selected.dateOfBirth,
                    "Financial aid": selected.financialAidStatus,
                  }).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section>
                <h3>Learning & campus snapshot</h3>
                <dl className="detail-fields">
                  {Object.entries({
                    Courses: selected.lmsSummary.enrolledCoursesCount,
                    "LMS attendance": selected.lmsSummary.enrolledCoursesCount
                      ? `${selected.lmsSummary.averageAttendance}%`
                      : "No LMS data",
                    "Average LMS score": selected.lmsSummary
                      .enrolledCoursesCount
                      ? `${selected.lmsSummary.averageLmsGrade}%`
                      : "No LMS data",
                    "Missed deadlines":
                      selected.lmsSummary.totalMissedDeadlines,
                    "Library clearance":
                      selected.librarySummary.clearanceStatus,
                    "Books borrowed": selected.librarySummary.activeBorrows,
                    "Outstanding fines": `$${selected.librarySummary.outstandingFines.toFixed(2)}`,
                    "Data completeness": `${selected.dataHealthScore}%`,
                  }).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
            <div className="detail-section">
              <h3>LMS course performance</h3>
              {selected.lmsSummary.courses.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Attendance</th>
                        <th>Assignments</th>
                        <th>Score</th>
                        <th>Missed deadlines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lmsSummary.courses.map((c) => (
                        <tr key={c.courseCode}>
                          <td>
                            <strong>{c.courseCode}</strong>
                            <span className="muted">{c.courseName}</span>
                          </td>
                          <td>{c.attendancePercentage}%</td>
                          <td>
                            {c.assignmentsCompleted}/{c.totalAssignments}
                          </td>
                          <td>
                            {c.currentScorePercentage}% · {c.letterGrade}
                          </td>
                          <td>{c.missedDeadlines}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="small muted" style={{ marginTop: 12 }}>
                  No course details available for this record or persona.
                </p>
              )}
            </div>
            <div className="inline-note" style={{ marginTop: 24 }}>
              <ShieldCheck size={16} />
              <span>
                Sources: SIS + LMS + Library · Last synchronized{" "}
                {formatTime(selected.lastSyncedAt)} SGT. Downloaded reports
                preserve this persona’s field permissions.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
