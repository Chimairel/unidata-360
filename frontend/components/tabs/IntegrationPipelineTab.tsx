"use client";
import { Fragment, useRef, useState } from "react";
import {
  ArrowRight,
  Database,
  Layers,
  ShieldCheck,
  Users,
  Upload,
  FileUp,
  Plus,
  RotateCcw,
  Play,
  CheckCircle2,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import type { Feed, SISRecord } from "@/shared/types";
import {
  DEPARTMENTS,
  DEPARTMENT_NAMES,
  type Department,
} from "@/shared/school";
import {
  Badge,
  EmptyState,
  formatTime,
  Modal,
  PageHeading,
} from "@/frontend/components/ui";
const feeds: Feed[] = ["SIS", "LMS", "LIBRARY"];
export function IntegrationPipelineTab() {
  const {
    sisRecords,
    lmsRecords,
    libraryRecords,
    masterRecords,
    sourceCounts,
    etlReports,
    currentRole,
    isSyncing,
    executeETL,
    resetAllData,
    importFile,
    importRecords,
  } = useEDM();
  const [feed, setFeed] = useState<Feed>("SIS");
  const [dragging, setDragging] = useState(false);
  const [inject, setInject] = useState(false);
  const [reset, setReset] = useState(false);
  const [filename, setFilename] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const report = etlReports[0];
  const canWrite = currentRole === "REGISTRAR";
  const upload = async (file?: File) => {
    if (file) {
      if (await importFile(feed, file)) setFilename(file.name);
    }
  };
  const downloadTemplate = (format: "csv" | "json") => {
    const row =
      feed === "SIS"
        ? sisRecords[0]
        : feed === "LMS"
          ? lmsRecords[0]
          : libraryRecords[0];
    if (!row) return;
    const content =
      format === "json"
        ? JSON.stringify([row], null, 2)
        : [
            Object.keys(row).join(","),
            Object.values(row)
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(","),
          ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], {
        type: format === "json" ? "application/json" : "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${feed.toLowerCase()}-template.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="page-stack">
      <PageHeading
        title="From siloed feeds to a trusted record."
        description="Validate source data, reconcile student identities, and publish a unified master store. Imports are staged until the next ETL run."
        action={
          <>
            <button
              className="button secondary"
              disabled={!canWrite || isSyncing}
              onClick={() => setInject(true)}
            >
              <Plus size={15} />
              Add demo student
            </button>
            <button
              className="button primary"
              disabled={!canWrite || isSyncing}
              onClick={() => void executeETL()}
            >
              <Play size={14} />
              {isSyncing ? "Processing…" : "Run pipeline"}
            </button>
          </>
        }
      />
      <div
        className="pipeline-flow"
        aria-label="Sources to integration to governance to outputs"
      >
        {[
          {
            title: "Sources",
            detail: `${sourceCounts.SIS} SIS · ${sourceCounts.LMS} LMS · ${sourceCounts.LIBRARY} Library`,
            icon: Database,
          },
          {
            title: "Integration",
            detail: "Validate, cleanse & reconcile",
            icon: Layers,
          },
          {
            title: "Governance",
            detail: "Role scope & field masking",
            icon: ShieldCheck,
          },
          {
            title: "Master store",
            detail: `${masterRecords.length} unified student records`,
            icon: Users,
          },
        ].map((stage, i) => (
          <Fragment key={stage.title}>
            {i > 0 && <ArrowRight className="flow-arrow" size={20} />}
            <div className="flow-stage">
              <stage.icon size={23} />
              <h3>{stage.title}</h3>
              <p>{stage.detail}</p>
            </div>
          </Fragment>
        ))}
      </div>
      {!canWrite && (
        <div className="inline-note">
          <ShieldCheck size={16} />
          <span>
            Source ingestion and ETL execution require the Registrar persona.
            The server withholds raw source rows from your current persona.
          </span>
        </div>
      )}
      <div className="split-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Upload a source feed</h2>
              <p>CSV or JSON · up to 2 MB · 1,000 rows per file</p>
            </div>
            <FileUp size={20} className="text-accent" />
          </div>
          <div className="panel-body">
            <div className="upload-controls">
              <label htmlFor="upload-feed">Destination feed</label>
              <select
                id="upload-feed"
                value={feed}
                disabled={!canWrite || isSyncing}
                onChange={(e) => {
                  setFeed(e.target.value as Feed);
                  setFilename("");
                }}
              >
                {feeds.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
            <div
              className={`upload-zone ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (canWrite) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (canWrite && !isSyncing)
                  void upload(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={25} />
              <h3>Drop your {feed} file here</h3>
              <p>
                Use the template’s column names. Existing keys are updated;
                duplicate keys use the last row.
              </p>
              <button
                className="button secondary"
                onClick={() => input.current?.click()}
                disabled={!canWrite || isSyncing}
              >
                Choose CSV or JSON
              </button>
              <input
                ref={input}
                type="file"
                accept=".csv,.json"
                aria-label="Upload source file"
                style={{ display: "none" }}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {filename && (
                <span className="small text-success">
                  <CheckCircle2
                    size={13}
                    style={{ display: "inline", marginRight: 5 }}
                  />
                  {filename} imported
                </span>
              )}
            </div>
            <div className="template-links">
              <button
                className="text-link"
                onClick={() => downloadTemplate("csv")}
                disabled={!canWrite}
              >
                Download {feed} CSV template
              </button>
              <button
                className="text-link"
                onClick={() => downloadTemplate("json")}
                disabled={!canWrite}
              >
                JSON template
              </button>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Latest pipeline run</h2>
              <p>
                {report
                  ? `${formatTime(report.startTime)} SGT`
                  : "Run ETL to reconcile source data"}
              </p>
            </div>
            {report && (
              <Badge tone={report.status === "SUCCESS" ? "success" : "warning"}>
                {report.status.replaceAll("_", " ")}
              </Badge>
            )}
          </div>
          <div className="panel-body">
            {report ? (
              <>
                <dl className="run-details">
                  <div>
                    <dt>Source rows extracted</dt>
                    <dd>
                      {Object.values(report.recordsExtracted).reduce(
                        (a, b) => a + b,
                        0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Master records loaded</dt>
                    <dd>{report.recordsLoaded}</dd>
                  </div>
                  <div>
                    <dt>Rejected / duplicate rows</dt>
                    <dd>{report.anomaliesDetected}</dd>
                  </div>
                  <div>
                    <dt>Reconciliation notices</dt>
                    <dd>{report.warnings.length}</dd>
                  </div>
                </dl>
                <ul className="warning-list">
                  {report.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {!report.warnings.length && (
                  <p className="small text-success" style={{ marginTop: 20 }}>
                    All records reconciled across the three source feeds.
                  </p>
                )}
              </>
            ) : (
              <EmptyState title="No pipeline reports available">
                Switch to a permitted persona to inspect ETL results.
              </EmptyState>
            )}
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Source record inspector</h2>
            <p>Raw transactional records · registrar access only</p>
          </div>
          <div className="feed-tabs">
            {feeds.map((f) => (
              <button
                key={f}
                className={feed === f ? "active" : ""}
                onClick={() => setFeed(f)}
                aria-pressed={feed === f}
              >
                {f} <span className="muted">{sourceCounts[f]}</span>
              </button>
            ))}
          </div>
        </div>
        {canWrite ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {feed === "SIS" ? (
                    <>
                      <th>Student ID</th>
                      <th>Student</th>
                      <th>Program</th>
                      <th>GPA</th>
                      <th>Standing</th>
                      <th>SSN · sensitive</th>
                    </>
                  ) : feed === "LMS" ? (
                    <>
                      <th>Student ID</th>
                      <th>Course</th>
                      <th>Attendance</th>
                      <th>Score</th>
                      <th>Missed deadlines</th>
                    </>
                  ) : (
                    <>
                      <th>Student ID</th>
                      <th>Active loans</th>
                      <th>Overdue</th>
                      <th>Fines</th>
                      <th>Clearance</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {feed === "SIS"
                  ? sisRecords.map((s) => (
                      <tr key={s.studentId}>
                        <td className="mono">{s.studentId}</td>
                        <td>
                          {s.firstName} {s.lastName}
                        </td>
                        <td>{s.major}</td>
                        <td>{s.cumulativeGpa.toFixed(2)}</td>
                        <td>{s.academicStanding}</td>
                        <td className="mono muted">{s.ssn}</td>
                      </tr>
                    ))
                  : feed === "LMS"
                    ? lmsRecords.map((s) => (
                        <tr key={`${s.studentId}:${s.courseCode}`}>
                          <td className="mono">{s.studentId}</td>
                          <td>
                            {s.courseCode}
                            <span className="muted">{s.courseName}</span>
                          </td>
                          <td>{s.attendancePercentage}%</td>
                          <td>{s.currentScorePercentage}%</td>
                          <td>{s.missedDeadlines}</td>
                        </tr>
                      ))
                    : libraryRecords.map((s) => (
                        <tr key={s.studentId}>
                          <td className="mono">{s.studentId}</td>
                          <td>{s.activeBorrows}</td>
                          <td>{s.overdueCount}</td>
                          <td>${s.outstandingFines.toFixed(2)}</td>
                          <td>{s.clearanceStatus}</td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Raw feed access restricted">
            Switch the demo persona to Registrar to inspect or import source
            records.
          </EmptyState>
        )}
      </section>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          alignItems: "center",
        }}
      >
        <p className="small">
          PostgreSQL records persist through page reloads and server restarts.
        </p>
        <button
          className="button quiet"
          disabled={!canWrite || isSyncing}
          onClick={() => setReset(true)}
        >
          <RotateCcw size={14} />
          Restore demo data
        </button>
      </div>
      {reset && (
        <Modal
          title="Restore the demonstration dataset?"
          onClose={() => setReset(false)}
        >
          <div className="modal-body">
            <p className="small">
              This replaces current source feeds and advisor follow-ups with the
              eight synthetic seed students. Previous ETL reports and the audit
              trail are retained.
            </p>
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => setReset(false)}
              >
                Cancel
              </button>
              <button
                className="button danger-button"
                disabled={isSyncing}
                onClick={async () => {
                  if (await resetAllData()) {
                    setReset(false);
                    setFilename("");
                  }
                }}
              >
                Restore demo data
              </button>
            </div>
          </div>
        </Modal>
      )}
      {inject && (
        <Modal
          title="Add a synthetic student to SIS"
          onClose={() => setInject(false)}
        >
          <div className="modal-body">
            <p className="small" style={{ marginBottom: 20 }}>
              Create a demonstration source record, then run ETL to add it to
              Student 360. Missing LMS and Library data will appear as
              reconciliation notices.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const gpa = Number(f.get("gpa"));
                const row: SISRecord = {
                  studentId: `STU-DEMO-${crypto.randomUUID().slice(0, 8)}`,
                  firstName: String(f.get("firstName")),
                  lastName: String(f.get("lastName")),
                  email: `demo-${crypto.randomUUID().slice(0, 8)}@example.edu`,
                  ssn: "999-00-0000",
                  dateOfBirth: "2004-01-01",
                  gender: "Not specified",
                  major:
                    DEPARTMENT_NAMES[String(f.get("department")) as Department],
                  department: String(f.get("department")),
                  yearLevel: "Freshman",
                  cumulativeGpa: gpa,
                  totalCredits: 15,
                  academicStanding:
                    gpa < 2 ? "Academic Probation" : "Good Standing",
                  financialAidStatus: "Self-Funded",
                  advisorName: "Dr. Evelyn Reed",
                  enrollmentStatus: "Active",
                };
                if (await importRecords("SIS", JSON.stringify([row])))
                  setInject(false);
              }}
            >
              <div className="form-grid">
                <label>
                  First name
                  <input name="firstName" required maxLength={100} />
                </label>
                <label>
                  Last name
                  <input name="lastName" required maxLength={100} />
                </label>
                <label>
                  Department
                  <select name="department">
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Cumulative GPA
                  <input
                    name="gpa"
                    type="number"
                    min="0"
                    max="4"
                    step="0.01"
                    defaultValue="3.20"
                    required
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setInject(false)}
                >
                  Cancel
                </button>
                <button className="button primary" disabled={isSyncing}>
                  Stage SIS record
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
