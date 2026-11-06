"use client";
import { useState } from "react";
import {
  Search,
  ArrowUpRight,
  ArrowUpDown,
  LayoutGrid,
  Rows3,
  Table2,
  X,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import type { UnifiedStudentRecord } from "@/lib/types";
import { EmptyState, RiskBadge, formatTime } from "./ui";
export function StudentDirectory({
  students,
  risk,
  setRisk,
  onOpen,
  busy,
}: {
  students: UnifiedStudentRecord[];
  risk: string;
  setRisk: (risk: string) => void;
  onOpen: (id: string) => Promise<void>;
  busy: boolean;
}) {
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("ALL");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<"list" | "table" | "cards">("list");
  const records = students
    .filter(
      (s) =>
        `${s.fullName} ${s.studentId} ${s.major}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (program === "ALL" || s.major === program) &&
        (risk === "ALL" ||
          (risk === "attention"
            ? s.overallRiskCategory !== "Safe"
            : s.overallRiskCategory === risk)),
    )
    .sort((a, b) =>
      sort === "gpa-desc"
        ? b.cumulativeGpa - a.cumulativeGpa
        : sort === "gpa-asc"
          ? a.cumulativeGpa - b.cumulativeGpa
          : sort === "risk"
            ? { "Critical Alert": 0, "Moderate Risk": 1, Safe: 2 }[
                a.overallRiskCategory
              ] -
                { "Critical Alert": 0, "Moderate Risk": 1, Safe: 2 }[
                  b.overallRiskCategory
                ] || a.fullName.localeCompare(b.fullName)
            : a.fullName.localeCompare(b.fullName),
    );
  const clear = () => {
    setSearch("");
    setProgram("ALL");
    setRisk("ALL");
  };
  const filtered = !!search || program !== "ALL" || risk !== "ALL";
  const latest = students
    .map((s) => s.lastSyncedAt)
    .sort()
    .at(-1);
  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("");
  const clearance = (s: UnifiedStudentRecord) =>
    s.librarySummary.clearanceStatus === "Hold Placed"
      ? "On hold"
      : s.librarySummary.clearanceStatus === "Cleared"
        ? "Cleared"
        : "Pending";
  return (
    <section
      id="student-directory"
      className="directory-section"
      aria-label="Student directory"
    >
      <div className="directory-section-heading">
        <div>
          <h2>
            Student directory{" "}
            <span className="directory-count">{students.length}</span>
          </h2>
          <p>Find a student and open their connected record.</p>
        </div>
        <div className="view-switch" role="group" aria-label="Directory view">
          <button
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <Rows3 size={16} />
          </button>
          <button
            aria-label="Table view"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <Table2 size={16} />
          </button>
          <button
            aria-label="Card view"
            aria-pressed={view === "cards"}
            onClick={() => setView("cards")}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>
      <div className="directory-controls">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search students"
            placeholder="Search by name, ID, or program…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="search-clear"
              aria-label="Clear student search"
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          aria-label="Filter by program"
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        >
          <option value="ALL">All programs</option>
          {[...new Set(students.map((s) => s.major))].sort().map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label className="sort-control">
          <ArrowUpDown size={14} />
          <select
            aria-label="Sort students"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Name A–Z</option>
            <option value="risk">Highest risk first</option>
            <option value="gpa-desc">Highest GPA first</option>
            <option value="gpa-asc">Lowest GPA first</option>
          </select>
        </label>
      </div>
      <div className="directory-filters">
        <div
          className="risk-filters"
          role="group"
          aria-label="Filter students by risk"
        >
          {[
            { value: "ALL", label: "All students", count: students.length },
            {
              value: "Safe",
              label: "Safe",
              count: students.filter((s) => s.overallRiskCategory === "Safe")
                .length,
            },
            {
              value: "Moderate Risk",
              label: "Moderate risk",
              count: students.filter(
                (s) => s.overallRiskCategory === "Moderate Risk",
              ).length,
            },
            {
              value: "Critical Alert",
              label: "Critical alerts",
              count: students.filter(
                (s) => s.overallRiskCategory === "Critical Alert",
              ).length,
            },
          ].map((f) => (
            <button
              key={f.value}
              aria-pressed={risk === f.value}
              onClick={() => setRisk(f.value)}
            >
              <span
                className={`filter-dot ${f.value === "Safe" ? "success" : f.value === "Moderate Risk" ? "warning" : f.value === "Critical Alert" ? "danger" : "neutral"}`}
              />
              {f.label}
              <span className="filter-count">{f.count}</span>
            </button>
          ))}
        </div>
        {filtered && (
          <button className="text-link reset-filters" onClick={clear}>
            Reset filters
          </button>
        )}
      </div>
      {risk === "attention" && (
        <div className="attention-filter" role="status">
          Showing students who need advisor attention{" "}
          <button
            aria-label="Clear attention filter"
            onClick={() => setRisk("ALL")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div className={`records-content ${view}-view`}>
        {records.length ? (
          <>
            {view === "list" && (
              <div className="student-row-list">
                {records.map((s) => (
                  <button
                    key={s.studentId}
                    className="student-list-record"
                    aria-label={`Open dossier for ${s.fullName}`}
                    disabled={busy}
                    onClick={() => void onOpen(s.studentId)}
                  >
                    <span className="avatar">{initials(s.fullName)}</span>
                    <span className="list-record-identity">
                      <strong>{s.fullName}</strong>
                      <span>{s.major}</span>
                      {s.overallRiskCategory !== "Safe" && (
                        <small
                          className={`list-record-status ${s.overallRiskCategory === "Critical Alert" ? "text-danger" : "text-warning"}`}
                        >
                          {s.overallRiskCategory}
                        </small>
                      )}
                    </span>
                    <span className="list-record-gpa">
                      <strong>{s.cumulativeGpa.toFixed(2)}</strong>
                      <small>GPA</small>
                    </span>
                    <span className="list-record-risk">
                      <RiskBadge risk={s.overallRiskCategory} />
                    </span>
                    <span className="list-record-action">
                      View record <ArrowUpRight size={13} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {view === "table" && (
              <div className="directory-table table-wrap">
                <table>
                  <caption className="visually-hidden">
                    Student records. Open a student’s name to view their
                    dossier.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Program & year</th>
                      <th
                        scope="col"
                        aria-sort={
                          sort === "gpa-desc"
                            ? "descending"
                            : sort === "gpa-asc"
                              ? "ascending"
                              : "none"
                        }
                      >
                        <button
                          className="table-sort"
                          onClick={() =>
                            setSort(
                              sort === "gpa-desc" ? "gpa-asc" : "gpa-desc",
                            )
                          }
                        >
                          GPA <ArrowUpDown size={12} />
                        </button>
                      </th>
                      <th scope="col">LMS attendance</th>
                      <th scope="col">Library clearance</th>
                      <th scope="col">Risk status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((s) => (
                      <tr key={s.studentId}>
                        <td>
                          <button
                            className="student-row-link"
                            aria-label={`Open dossier for ${s.fullName}`}
                            disabled={busy}
                            onClick={() => void onOpen(s.studentId)}
                          >
                            <span className="avatar">
                              {initials(s.fullName)}
                            </span>
                            <span>
                              <strong>{s.fullName}</strong>
                              <span className="student-row-id">
                                {s.studentId}
                              </span>
                            </span>
                            <ArrowUpRight size={14} className="row-open-icon" />
                          </button>
                        </td>
                        <td>
                          <span className="program-name">{s.major}</span>
                          <span className="row-secondary">{s.yearLevel}</span>
                        </td>
                        <td>
                          <strong
                            className={s.cumulativeGpa < 2 ? "text-danger" : ""}
                          >
                            {s.cumulativeGpa.toFixed(2)}
                          </strong>
                          <span className="gpa-scale"> / 4.00</span>
                        </td>
                        <td>
                          <span className="attendance-value">
                            {s.lmsSummary.enrolledCoursesCount
                              ? `${s.lmsSummary.averageAttendance}%`
                              : "No LMS data"}
                          </span>
                          {s.lmsSummary.enrolledCoursesCount > 0 && (
                            <span className="attendance-bar" aria-hidden="true">
                              <span
                                style={{
                                  width: `${s.lmsSummary.averageAttendance}%`,
                                }}
                                className={
                                  s.lmsSummary.averageAttendance < 65
                                    ? "danger"
                                    : s.lmsSummary.averageAttendance < 80
                                      ? "warning"
                                      : ""
                                }
                              />
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`clearance-status ${clearance(s) === "Cleared" ? "text-success" : "text-warning"}`}
                          >
                            <span className="status-dot" />
                            {clearance(s)}
                          </span>
                        </td>
                        <td>
                          <RiskBadge risk={s.overallRiskCategory} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="student-grid">
              {records.map((s) => (
                <button
                  key={s.studentId}
                  className="student-card"
                  aria-label={`Open dossier for ${s.fullName}`}
                  disabled={busy}
                  onClick={() => void onOpen(s.studentId)}
                >
                  <div className="student-card-top">
                    <div className="student-identity">
                      <span className="avatar">{initials(s.fullName)}</span>
                      <div>
                        <h3>{s.fullName}</h3>
                        <span className="mono">{s.studentId}</span>
                      </div>
                    </div>
                    <RiskBadge risk={s.overallRiskCategory} />
                  </div>
                  <div className="student-program">{s.major}</div>
                  <div className="student-year">
                    {s.yearLevel} · {s.enrollmentStatus}
                  </div>
                  <dl className="student-metrics">
                    <div>
                      <dt>Cumulative GPA</dt>
                      <dd>{s.cumulativeGpa.toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>LMS attendance</dt>
                      <dd>
                        {s.lmsSummary.enrolledCoursesCount
                          ? `${s.lmsSummary.averageAttendance}%`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Library clearance</dt>
                      <dd
                        className={`clearance-label ${clearance(s) === "Cleared" ? "text-success" : "text-warning"}`}
                      >
                        {clearance(s)}
                      </dd>
                    </div>
                  </dl>
                  <div className="student-card-bottom">
                    <span>
                      <ShieldCheck size={12} />
                      {s.dataHealthScore}% complete
                    </span>
                    <span className="open-profile">
                      Open dossier <ArrowUpRight size={14} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="No students match these filters">
            Try another name or student ID, or clear the program and risk
            filters.{" "}
            <button className="text-link" onClick={clear}>
              Clear filters
            </button>
          </EmptyState>
        )}
      </div>
      <div className="directory-footer">
        <span role="status" aria-live="polite">
          Showing <strong>{records.length}</strong> of {students.length}{" "}
          {students.length === 1 ? "student" : "students"}
        </span>
        <span>
          <Clock3 size={13} />
          {latest
            ? `Synced ${formatTime(latest)} SGT`
            : "Run ETL to publish source records"}
        </span>
      </div>
    </section>
  );
}
