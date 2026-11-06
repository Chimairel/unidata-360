"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Database,
  Library,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { useEDM } from "@/lib/context/EDMContext";
import { formatTime } from "./ui";
export function CohortInsights({
  onAttention,
  onOpen,
}: {
  onAttention: () => void;
  onOpen: (id: string) => Promise<void>;
}) {
  const { masterRecords: students, sourceCounts, etlReports } = useEDM();
  const [metric, setMetric] = useState<"gpa" | "attendance">("gpa");
  const sorted = [...students].sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
  const flagged = students.filter((s) => s.overallRiskCategory !== "Safe");
  const total = students.length;
  const average = total
    ? students.reduce((n, s) => n + s.cumulativeGpa, 0) / total
    : 0;
  const complete = total
    ? Math.round(students.reduce((n, s) => n + s.dataHealthScore, 0) / total)
    : 0;
  const plotted =
    metric === "gpa"
      ? sorted
      : sorted.filter((s) => s.lmsSummary.enrolledCoursesCount > 0);
  const max = metric === "gpa" ? 4 : 100;
  const points = plotted.map((s, i) => ({
    x: 32 + (plotted.length > 1 ? (i / (plotted.length - 1)) * 254 : 127),
    y:
      170 -
      ((metric === "gpa" ? s.cumulativeGpa : s.lmsSummary.averageAttendance) /
        max) *
        136,
    s,
    value:
      metric === "gpa"
        ? s.cumulativeGpa.toFixed(2)
        : s.lmsSummary.averageAttendance + "%",
  }));
  const attention = [...flagged]
    .sort((a, b) => a.cumulativeGpa - b.cumulativeGpa)
    .slice(0, 2);
  return (
    <aside className="cohort-insights" aria-label="Cohort insights">
      <div className="insight-counters">
        <div>
          <strong>{total}</strong>
          <span>
            Student{total === 1 ? "" : "s"}
            <br />
            in scope
          </span>
        </div>
        <button
          onClick={onAttention}
          aria-label="Show students needing advisor attention"
        >
          <strong>{flagged.length}</strong>
          <span>
            Need advisor
            <br />
            attention
          </span>
          <ArrowUpRight size={13} />
        </button>
      </div>
      <section className="statistics-section">
        <div className="insight-heading">
          <h2>Your statistics</h2>
          <span>Current cohort</span>
        </div>
        <div className="chart-tabs" role="group" aria-label="Chart metric">
          <button
            aria-pressed={metric === "gpa"}
            onClick={() => setMetric("gpa")}
          >
            Cumulative GPA
          </button>
          <button
            aria-pressed={metric === "attendance"}
            onClick={() => setMetric("attendance")}
          >
            LMS attendance
          </button>
        </div>
        {points.length ? (
          <svg
            className="cohort-line-chart"
            viewBox="0 0 310 205"
            role="img"
            aria-label={`${metric === "gpa" ? "Cumulative GPA" : "LMS attendance"} by student: ${points.map((p) => p.s.fullName + " " + p.value).join("; ")}`}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <line
                  x1="32"
                  x2="288"
                  y1={170 - i * 34}
                  y2={170 - i * 34}
                  className="chart-gridline"
                />
                <text x="8" y={174 - i * 34}>
                  {metric === "gpa" ? i : i * 25}
                </text>
              </g>
            ))}
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {points.map((p) => (
              <g key={p.s.studentId}>
                <circle cx={p.x} cy={p.y} r="3.7" fill="currentColor">
                  <title>
                    {p.s.fullName}: {p.value}
                  </title>
                </circle>
                <text x={p.x} y="195" textAnchor="middle">
                  {p.s.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <p className="chart-empty">
            No {metric === "gpa" ? "student" : "LMS"} records in your scope yet.
          </p>
        )}
        <div className="chart-caption">
          <span>
            {metric === "gpa" ? "GPA on a 4.00 scale" : "Attendance percentage"}{" "}
            · by student
          </span>
          <strong>
            {metric === "gpa"
              ? average.toFixed(2) + " avg"
              : plotted.length + " with LMS"}
          </strong>
        </div>
      </section>
      <section className="source-health">
        <div className="insight-heading">
          <h2>Connected & current</h2>
          <ShieldCheck size={21} />
        </div>
        <p>Three sources. One trusted student view.</p>
        <div className="health-score">
          <strong>{complete}%</strong>
          <span>
            average source
            <br />
            completeness
          </span>
        </div>
        <div className="source-health-feeds">
          {[
            { name: "Student information", key: "SIS", icon: Database },
            { name: "Canvas LMS", key: "LMS", icon: BookOpen },
            { name: "Campus library", key: "LIBRARY", icon: Library },
          ].map(({ name, key, icon: Icon }) => (
            <div key={key}>
              <Icon size={15} />
              <span>{name}</span>
              <strong>{sourceCounts[key as keyof typeof sourceCounts]}</strong>
            </div>
          ))}
        </div>
        <small>
          {etlReports[0]
            ? `Last ETL · ${formatTime(etlReports[0].endTime)} SGT`
            : "Permitted source records"}
        </small>
      </section>
      {attention.length > 0 && (
        <section className="attention-queue">
          <div className="insight-heading">
            <h2>A little attention</h2>
            <span>{flagged.length} flagged</span>
          </div>
          <p>A good moment to check in.</p>
          {attention.map((s) => (
            <button
              key={s.studentId}
              onClick={() => void onOpen(s.studentId)}
              aria-label={`Review ${s.fullName}`}
            >
              <span>
                <strong>{s.fullName}</strong>
                <small>{s.overallRiskCategory}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </section>
      )}
      <p className="insights-note">
        Synthetic course dataset · Current snapshot, not a longitudinal
        prediction.
      </p>
    </aside>
  );
}
