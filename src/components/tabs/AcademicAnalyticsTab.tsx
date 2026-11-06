"use client";
import { useEDM } from "@/lib/context/EDMContext";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  Badge,
  EmptyState,
  PageHeading,
  ReportLink,
  RiskBadge,
} from "@/components/ui";
export function AcademicAnalyticsTab() {
  const {
    masterRecords,
    interventions,
    assignAdvisor,
    currentRole,
    isSyncing,
  } = useEDM();
  const students = masterRecords;
  const total = students.length;
  const avg = total
    ? students.reduce((n, s) => n + s.cumulativeGpa, 0) / total
    : 0;
  const atRisk = students
    .filter((s) => s.overallRiskCategory !== "Safe")
    .sort((a, b) => a.cumulativeGpa - b.cumulativeGpa);
  const active = students.filter((s) => s.enrollmentStatus === "Active").length;
  const programs = [...new Set(students.map((s) => s.major))].map((major) => {
    const records = students.filter((s) => s.major === major);
    return {
      major,
      count: records.length,
      gpa: records.reduce((n, s) => n + s.cumulativeGpa, 0) / records.length,
    };
  });
  const bins = [
    {
      label: "3.50 – 4.00",
      count: students.filter((s) => s.cumulativeGpa >= 3.5).length,
    },
    {
      label: "3.00 – 3.49",
      count: students.filter(
        (s) => s.cumulativeGpa >= 3 && s.cumulativeGpa < 3.5,
      ).length,
    },
    {
      label: "2.00 – 2.99",
      count: students.filter((s) => s.cumulativeGpa >= 2 && s.cumulativeGpa < 3)
        .length,
    },
    {
      label: "Below 2.00",
      count: students.filter((s) => s.cumulativeGpa < 2).length,
    },
  ];
  const canAssign = ["DEAN_REGISTRAR", "ACADEMIC_ADVISOR"].includes(
    currentRole,
  );
  return (
    <div className="page-stack">
      <PageHeading
        title={
          currentRole === "STUDENT"
            ? "Your academic snapshot"
            : "See progress. Spot who needs support."
        }
        description="A current view of academic performance and engagement, with explainable early-warning indicators and saved advisor follow-ups."
        action={<ReportLink kind="analytics" label="Download analytics PDF" />}
      />
      <dl className="summary-strip">
        <div className="summary-item">
          <dt>Students in scope</dt>
          <dd>{total}</dd>
        </div>
        <div className="summary-item">
          <dt>Average GPA</dt>
          <dd>
            {avg.toFixed(2)}
            <span>/ 4.00</span>
          </dd>
        </div>
        <div className="summary-item">
          <dt>Currently active</dt>
          <dd>
            {active}
            <span>of {total}</span>
          </dd>
        </div>
        <div className="summary-item">
          <dt>Academic probation</dt>
          <dd>
            {
              students.filter(
                (s) => s.academicStanding === "Academic Probation",
              ).length
            }
            <span>students</span>
          </dd>
        </div>
      </dl>
      <div className="split-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>GPA distribution</h2>
              <p>Student count by cumulative grade band</p>
            </div>
            <Badge>SIS master data</Badge>
          </div>
          <div className="panel-body">
            <div
              role="img"
              aria-label={`GPA distribution: ${bins.map((b) => `${b.label}: ${b.count} students`).join("; ")}`}
            >
              {bins.map((b) => (
                <div className="chart-row" key={b.label}>
                  <span className="chart-label">{b.label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${total ? (b.count / total) * 100 : 0}%`,
                        background:
                          b.label === "Below 2.00" ? "#e18b9b" : undefined,
                      }}
                    />
                  </div>
                  <span className="chart-value">{b.count}</span>
                </div>
              ))}
            </div>
            <p className="distribution-caption">
              Grade bands use the institution’s 4.00 GPA scale.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Program overview</h2>
              <p>Cohort size and average cumulative GPA</p>
            </div>
          </div>
          <div className="panel-body">
            {programs.map((p) => (
              <div className="program-row" key={p.major}>
                <div>
                  {p.major}
                  <small>
                    {p.count} {p.count === 1 ? "student" : "students"}
                  </small>
                </div>
                <strong>
                  {p.gpa.toFixed(2)} <span className="muted">/ 4.00</span>
                </strong>
              </div>
            ))}
            {!programs.length && (
              <EmptyState title="No program data yet">
                Import SIS records and run ETL.
              </EmptyState>
            )}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <AlertTriangle size={18} className="text-warning" />
              Early-warning radar
            </h2>
            <p>
              Prioritize human review using academic, engagement, and clearance
              signals.
            </p>
          </div>
          <Badge tone="warning">{atRisk.length} need attention</Badge>
        </div>
        {atRisk.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>GPA</th>
                  <th>Attendance</th>
                  <th>Signals</th>
                  <th>Risk level</th>
                  <th>Advisor follow-up</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((s) => {
                  const assigned = interventions.find(
                    (i) => i.studentId === s.studentId && i.status === "Open",
                  );
                  return (
                    <tr key={s.studentId}>
                      <td>
                        <strong>{s.fullName}</strong>
                        <span className="muted">{s.major}</span>
                      </td>
                      <td>{s.cumulativeGpa.toFixed(2)}</td>
                      <td>
                        {s.lmsSummary.enrolledCoursesCount
                          ? `${s.lmsSummary.averageAttendance}%`
                          : "No LMS data"}
                      </td>
                      <td>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 5 }}
                        >
                          {s.cumulativeGpa < 2.5 && (
                            <Badge tone="warning">Low GPA</Badge>
                          )}
                          {s.lmsSummary.enrolledCoursesCount > 0 &&
                            s.lmsSummary.averageAttendance < 80 && (
                              <Badge tone="warning">Attendance</Badge>
                            )}
                          {s.lmsSummary.totalMissedDeadlines >= 2 && (
                            <Badge tone="warning">
                              {s.lmsSummary.totalMissedDeadlines} missed
                              deadlines
                            </Badge>
                          )}
                          {s.librarySummary.clearanceStatus ===
                            "Hold Placed" && (
                            <Badge tone="warning">Library hold</Badge>
                          )}
                          {s.academicStanding === "Academic Probation" && (
                            <Badge tone="danger">Probation</Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <RiskBadge risk={s.overallRiskCategory} />
                      </td>
                      <td>
                        {assigned ? (
                          <>
                            <span
                              className="small text-success"
                              style={{
                                display: "flex",
                                gap: 5,
                                alignItems: "center",
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Follow-up saved
                            </span>
                            <span className="muted">
                              {assigned.advisorName}
                            </span>
                          </>
                        ) : (
                          <button
                            className="button secondary"
                            disabled={!canAssign || isSyncing}
                            onClick={() => void assignAdvisor(s.studentId)}
                            title={
                              !canAssign
                                ? "Advisor or registrar access is required"
                                : undefined
                            }
                          >
                            Assign advisor
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No students currently flagged">
            All students in your scope are below the configured warning
            thresholds.
          </EmptyState>
        )}
      </section>
      <div className="inline-note">
        <Info size={16} />
        <span>
          Critical: GPA below 2.00, attendance below 65% when LMS data exists,
          4+ missed deadlines, or probation. Moderate: GPA below 2.50,
          attendance below 80%, 2+ missed deadlines, or a library hold. These
          rules support human review. Current enrollment is a snapshot; a
          retention rate requires longitudinal data.
        </span>
      </div>
    </div>
  );
}
