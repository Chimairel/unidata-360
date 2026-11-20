"use client";
import { useState } from "react";
import { DEPARTMENTS } from "@/shared/school";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Badge,
  EmptyState,
  PageHeading,
  ReportLink,
  RiskBadge,
} from "@/frontend/components/ui";
export function AcademicAnalyticsTab({
  onOpenCase,
}: {
  onOpenCase: (studentId: string) => void;
}) {
  const {
    masterRecords,
    interventions,
    currentRole,
    accessMode,
    departmentScope,
  } = useEDM();
  const [department, setDepartment] = useState("ALL");
  const students = masterRecords.filter(
    (s) => department === "ALL" || s.department === department,
  );
  const total = students.length;
  const avg = total
    ? students.reduce((n, s) => n + s.cumulativeGpa, 0) / total
    : 0;
  const atRisk = students
    .filter((s) => s.overallRiskCategory !== "Safe")
    .sort((a, b) => b.cumulativeGpa - a.cumulativeGpa);
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
      label: "1.00 – 1.75 (Dean's List)",
      count: students.filter((s) => s.cumulativeGpa <= 1.75).length,
      danger: false,
    },
    {
      label: "1.76 – 2.49 (Good)",
      count: students.filter(
        (s) => s.cumulativeGpa > 1.75 && s.cumulativeGpa < 2.5,
      ).length,
      danger: false,
    },
    {
      label: "2.50 – 2.99 (At-Risk)",
      count: students.filter(
        (s) => s.cumulativeGpa >= 2.5 && s.cumulativeGpa < 3,
      ).length,
      danger: false,
    },
    {
      label: "3.00 – 5.00 (Fail)",
      count: students.filter((s) => s.cumulativeGpa >= 3).length,
      danger: true,
    },
  ];
  const canAssign = ["REGISTRAR", "DEAN", "ACADEMIC_ADVISOR"].includes(
    currentRole,
  );
  return (
    <div className="page-stack">
      <PageHeading
        title={
          currentRole === "DEAN"
            ? `${departmentScope} academic overview`
            : "Academic analytics"
        }
        action={
          <ReportLink
            kind="analytics"
            department={department === "ALL" ? departmentScope : department}
            label="Download analytics PDF"
          />
        }
      />
      <label className="department-filter">
        Department
        <select
          aria-label="Analytics department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="ALL">
            {departmentScope
              ? `${departmentScope} department`
              : "All departments"}
          </option>
          {!departmentScope &&
            DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </label>
      <dl className="summary-strip">
        <div className="summary-item">
          <dt>Students in scope</dt>
          <dd>{total}</dd>
        </div>
        <div className="summary-item">
          <dt>Average GWA</dt>
          <dd>
            {avg.toFixed(2)}
            <span>1.00 – 5.00</span>
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
              <h2>GWA distribution</h2>
            </div>
            <Badge>SIS master data</Badge>
          </div>
          <div className="panel-body">
            <div
              role="img"
              aria-label={`GWA distribution: ${bins.map((b) => `${b.label}: ${b.count} students`).join("; ")}`}
            >
              {bins.map((b) => (
                <div className="chart-row" key={b.label}>
                  <span className="chart-label">{b.label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${total ? (b.count / total) * 100 : 0}%`,
                        background: b.danger ? "#e18b9b" : undefined,
                      }}
                    />
                  </div>
                  <span className="chart-value">{b.count}</span>
                </div>
              ))}
            </div>
            <p className="distribution-caption">
              1.00 (highest) – 5.00 (fail) · 3.00 or worse = fail (5.00)
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Program overview</h2>
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
                  {p.gpa.toFixed(2)} <span className="muted">GWA</span>
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
            <p>Flags for staff review.</p>
          </div>
          <Badge tone="warning">{atRisk.length} need attention</Badge>
        </div>
        {atRisk.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>GWA</th>
                  <th>Attendance</th>
                  <th>Signals</th>
                  <th>Risk level</th>
                  <th>Advisor follow-up</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((s) => {
                  const assigned = interventions.find(
                    (i) =>
                      i.studentId === s.studentId && i.status !== "Resolved",
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
                          {s.cumulativeGpa >= 3 ? (
                            <Badge tone="danger">Failing GWA</Badge>
                          ) : (
                            s.cumulativeGpa >= 2.5 && (
                              <Badge tone="warning">At-Risk GWA</Badge>
                            )
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
                              Case {assigned.status.toLowerCase()}
                            </span>
                            <span className="muted">
                              {assigned.advisorName}
                            </span>
                            <button
                              className="button secondary"
                              onClick={() => onOpenCase(s.studentId)}
                            >
                              Review case
                            </button>
                          </>
                        ) : (
                          <button
                            className="button secondary"
                            disabled={!canAssign || accessMode !== "account"}
                            onClick={() => onOpenCase(s.studentId)}
                            title={
                              !canAssign
                                ? "Advisor or registrar access is required"
                                : undefined
                            }
                          >
                            Open support case
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
            No warning signals in this cohort.
          </EmptyState>
        )}
      </section>
      <details className="panel workflow-disclosure">
        <summary>Warning criteria</summary>
        <p className="panel-body small">
          Critical: GWA 3.00–5.00 (exact 3.00 or worse is a failing 5.00),
          attendance below 65% when LMS data exists, 4+ missed deadlines, or
          probation. Moderate: GWA 2.50–2.99, attendance below 80%, 2+ missed
          deadlines, or a library hold. These rules support human review.
          Current enrollment is a snapshot; a retention rate requires
          longitudinal data.
        </p>
      </details>
    </div>
  );
}
