"use client";
import { useState } from "react";
import { CohortInsights } from "@/frontend/components/CohortInsights";
import { StudentDirectory } from "@/frontend/components/StudentDirectory";
import { StudentAccounts } from "@/frontend/components/StudentAccounts";
import { ShieldCheck, Users, ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/frontend/components/BrandMark";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import {
  Badge,
  formatTime,
  Modal,
  ReportLink,
  RiskBadge,
} from "@/frontend/components/ui";
import { studentLifecycleSummary } from "@/frontend/lib/courseAlignment";

export function Student360Tab() {
  const {
    masterRecords,
    currentRole,
    viewStudent,
    graduateStudent,
    isSyncing,
    actorName,
    departmentScope,
    accessMode,
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
      <div
        className={`student-dashboard ${currentRole === "COMPLIANCE_AUDITOR" ? "audit-review-dashboard" : ""}`}
      >
        <div className="student-dashboard-main">
          <section className="welcome-banner">
            <div>
              <h1>
                {currentRole === "COMPLIANCE_AUDITOR"
                  ? "Masked student summaries"
                  : currentRole === "DEAN"
                    ? `${departmentScope} student overview`
                    : currentRole === "REGISTRAR"
                      ? "School student records"
                      : "Hello, "}
                {!["COMPLIANCE_AUDITOR", "DEAN", "REGISTRAR"].includes(
                  currentRole,
                ) && (
                  <>
                    {currentRole === "STUDENT"
                      ? masterRecords[0]?.fullName.split(" ")[0] || "there"
                      : actorName.split(" ").find((n) => !n.includes(".")) ||
                        "there"}
                    !
                  </>
                )}
              </h1>
              <span>
                {currentRole === "ACADEMIC_ADVISOR"
                  ? "Academic advising"
                  : currentRole === "COMPLIANCE_AUDITOR"
                    ? "Compliance review"
                    : currentRole === "DEAN"
                      ? `${departmentScope} · Dean workspace`
                      : "Registrar workspace"}
              </span>
            </div>
            <div className="welcome-emblem" aria-hidden="true">
              <BrandMark size={58} />
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
              <strong>{completeness}% source completeness</strong>
              <span>SIS · LMS · Library · HR · Alumni</span>
            </div>
            <Badge tone="info">
              {currentRole === "REGISTRAR"
                ? "Registrar access"
                : "Masked fields"}
            </Badge>
            <ArrowUpRight size={20} />
          </div>
          {currentRole === "REGISTRAR" && accessMode === "account" && (
            <StudentAccounts key={actorName} />
          )}
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
        {currentRole !== "COMPLIANCE_AUDITOR" && (
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
        )}
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
                {currentRole === "REGISTRAR" &&
                  selected.enrollmentStatus !== "Graduated" && (
                    <button
                      type="button"
                      className="button secondary"
                      disabled={isSyncing}
                      onClick={() => void graduateStudent(selected.studentId)}
                    >
                      Graduate → Alumni
                    </button>
                  )}
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
                <h3>Academic &amp; personal record</h3>
                <dl className="detail-fields">
                  {Object.entries({
                    Email: selected.email,
                    "Year level": selected.yearLevel,
                    "Cumulative GWA": `${selected.cumulativeGpa.toFixed(2)}${selected.cumulativeGpa >= 3 ? " (Fail)" : " (1.00–5.00)"}`,
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
                <h3>Learning, campus &amp; HR snapshot</h3>
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
                    "Lifecycle stage": studentLifecycleSummary(selected).stage,
                    "Graduation review":
                      studentLifecycleSummary(selected).graduationContext,
                    ...(selected.hrSummary
                      ? {
                          "Advisor title (HR)": `${selected.hrSummary.title} · ${selected.hrSummary.coursesTaught}`,
                          "HR payroll band": selected.hrSummary.payrollBand,
                        }
                      : {}),
                    ...(selected.alumniSummary
                      ? {
                          "Alumni class": `${selected.alumniSummary.graduationYear} · ${selected.alumniSummary.employmentStatus}`,
                          "Alumni employer": selected.alumniSummary.employer,
                          "GDPR consent": selected.alumniSummary.contactConsent,
                        }
                      : {}),
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
                SIS · LMS · Library · Updated{" "}
                {formatTime(selected.lastSyncedAt)} SGT
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
