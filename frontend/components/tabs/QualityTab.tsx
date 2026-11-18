"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Play, Upload } from "lucide-react";
import type { QualityWorkspace, QualityIssue, Feed } from "@/shared/types";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { useWorkflowWorkspace } from "@/frontend/lib/useWorkflowWorkspace";
import { Badge, EmptyState, PageHeading, formatTime } from "../ui";

export function QualityTab() {
  const {
    currentRole,
    accessMode,
    executeETL,
    isSyncing,
    importFile,
    masterRecords,
  } = useEDM();
  const state = useWorkflowWorkspace<QualityWorkspace>(
    "/api/quality",
    accessMode === "account",
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Active");
  const [feed, setFeed] = useState("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [uploadFeed, setUploadFeed] = useState<Feed>("LMS");
  const [lineage, setLineage] = useState("");
  const data = state.data;
  const canWrite = currentRole === "REGISTRAR";
  const busy = state.busy || isSyncing;
  const issue = data?.issues.find((i) => i.id === selected);
  const shown =
    data?.issues.filter(
      (i) =>
        (status === "All" ||
          (status === "Active"
            ? i.status !== "Resolved"
            : i.status === status)) &&
        (feed === "ALL" || i.feed === feed) &&
        `${i.sourceKey} ${i.studentId} ${i.rule} ${i.ownerName || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  async function recheck() {
    if (await executeETL()) await state.reload();
  }
  const selectedStudent = lineage || data?.students[0]?.studentId;
  const published = masterRecords.find(
    (s) => s.studentId === selectedStudent,
  )?.lastSyncedAt;
  return (
    <div className="page-stack workflow-page">
      <PageHeading
        title="Data quality"
        description="Find broken source relationships, assign a steward and verify corrections when ETL republishes the master."
        action={
          accessMode === "account" &&
          canWrite && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void recheck()}
            >
              <Play size={16} />
              {isSyncing ? "Checking…" : "Run ETL and recheck"}
            </button>
          )
        }
      />
      {accessMode !== "account" ? (
        <section className="panel panel-body">
          <h2>Use a staff account to inspect quality work</h2>
          <p>
            Sign in as Registrar to manage issues, or Compliance Auditor to
            inspect quality history.
          </p>
          <Link className="button primary" href="/login">
            Sign in
          </Link>
        </section>
      ) : (
        <>
          {state.error && (
            <p className="message error" role="alert">
              {state.error}
            </p>
          )}
          {state.message && (
            <p className="message success" role="status">
              {state.message}
            </p>
          )}
          {state.loading && !data && (
            <div className="loading-state" aria-busy="true">
              <p>Loading quality checks and source metadata…</p>
            </div>
          )}
          {data && (
            <>
              <p className="workflow-scope">
                {data.issues.filter((i) => i.status !== "Resolved").length}{" "}
                active issues ·{" "}
                {data.issues.filter((i) => i.status === "Resolved").length}{" "}
                resolved.{" "}
                {data.checkedAt
                  ? `Last source check: ${formatTime(data.checkedAt)}.`
                  : "Run ETL to initialize the source checks."}{" "}
                {canWrite
                  ? "Corrections are staged; the master changes only after ETL."
                  : "Auditor access is read-only. Raw source values are withheld."}
              </p>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Quality issue queue</h2>
                    <p>
                      Missing feeds and source identities that cannot be
                      reconciled.
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    disabled={state.loading || busy}
                    onClick={() => void state.reload()}
                  >
                    <RefreshCw size={15} />
                    Reload
                  </button>
                </div>
                <div className="workflow-filters">
                  <label>
                    Search quality issues
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Student ID, source key or steward…"
                    />
                  </label>
                  <label>
                    Issue status
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option>Active</option>
                      <option>All</option>
                      <option>Open</option>
                      <option>In progress</option>
                      <option>Resolved</option>
                    </select>
                  </label>
                  <label>
                    Source feed
                    <select
                      value={feed}
                      onChange={(e) => setFeed(e.target.value)}
                    >
                      <option value="ALL">All feeds</option>
                      <option>SIS</option>
                      <option>LMS</option>
                      <option>LIBRARY</option>
                    </select>
                  </label>
                </div>
                {shown.length ? (
                  <div className="table-wrap">
                    <table className="workflow-table">
                      <thead>
                        <tr>
                          <th>Source / record</th>
                          <th>Check</th>
                          <th>Steward</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((i) => (
                          <tr key={i.id}>
                            <td>
                              <strong>{i.feed}</strong>
                              <span className="workflow-secondary">
                                {i.sourceKey}
                              </span>
                            </td>
                            <td>
                              {i.rule.replaceAll("_", " ")}
                              <span className="workflow-secondary">
                                {i.severity} · {formatTime(i.lastSeenAt)}
                              </span>
                            </td>
                            <td>{i.ownerName || "Unassigned"}</td>
                            <td>
                              <Badge
                                tone={
                                  i.status === "Resolved"
                                    ? "success"
                                    : i.severity === "Error"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {i.status}
                              </Badge>
                            </td>
                            <td>
                              <button
                                className="button secondary"
                                onClick={() => {
                                  setSelected(i.id);
                                  setUploadFeed(i.feed);
                                }}
                                aria-label={`Inspect ${i.rule} for ${i.sourceKey}`}
                              >
                                Inspect issue
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title={
                      data.checkedAt
                        ? "No issues in this view"
                        : "Quality checks are ready to run"
                    }
                  >
                    {data.checkedAt
                      ? "The last check found no matching issues. Change filters to inspect resolved work."
                      : "Registrar: run ETL to assess source relationships and publish the current master."}
                  </EmptyState>
                )}
              </section>
              {issue && (
                <QualityDetail
                  key={`${issue.id}:${issue.history.length}:${issue.status}`}
                  issue={issue}
                  data={data}
                  canWrite={canWrite}
                  busy={busy}
                  save={state.save}
                  onClose={() => setSelected(null)}
                />
              )}
              {canWrite && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Stage a source correction</h2>
                      <p>
                        Upload a corrected CSV or JSON feed. The same validation
                        and atomic import rules apply as in Pipeline.
                      </p>
                    </div>
                    <Upload size={20} />
                  </div>
                  <div className="panel-body workflow-repair">
                    <label>
                      Correction feed
                      <select
                        value={uploadFeed}
                        onChange={(e) => setUploadFeed(e.target.value as Feed)}
                        disabled={busy}
                      >
                        <option>SIS</option>
                        <option>LMS</option>
                        <option>LIBRARY</option>
                      </select>
                    </label>
                    <label>
                      Corrected source file
                      <input
                        type="file"
                        accept=".csv,.json"
                        disabled={busy}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && (await importFile(uploadFeed, file)))
                            await state.reload();
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="small muted">
                      Use the source templates from Pipeline. Importing stages
                      the correction; run ETL above to publish it and
                      automatically resolve passed checks.
                    </p>
                  </div>
                </section>
              )}
              <details className="panel workflow-disclosure">
                <summary>Source catalog and field lineage</summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Business owner</th>
                        <th>Record key</th>
                        <th>Rows</th>
                        <th>Latest receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sources.map((s) => (
                        <tr key={s.feed}>
                          <td>{s.name}</td>
                          <td>{s.owner}</td>
                          <td>{s.key}</td>
                          <td>{s.rows}</td>
                          <td>
                            {s.lastReceivedAt
                              ? formatTime(s.lastReceivedAt)
                              : "Unknown — legacy import"}
                            {s.unknownProvenance > 0 && (
                              <span className="workflow-secondary">
                                {s.unknownProvenance} records have unknown
                                receipt time
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel-body">
                  <h3>Field lineage</h3>
                  <p className="small muted">
                    Published identity, enrollment and GPA come from SIS;
                    learning metrics from LMS; clearance from Library. Risk
                    combines those fields using the published rules. Receipt
                    metadata describes staged records; it is not a snapshot of
                    every previous field value.
                  </p>
                  <label>
                    Lineage student
                    <select
                      value={selectedStudent || ""}
                      onChange={(e) => setLineage(e.target.value)}
                    >
                      {data.students.map((s) => (
                        <option key={s.studentId} value={s.studentId}>
                          {s.fullName} · {s.studentId}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="small">
                    Master last published:{" "}
                    {published ? formatTime(published) : "Not published"}.
                    Source coverage is the fraction of the three feeds present:
                    1/3 = 33%, 2/3 = 67%, 3/3 = 100%. It does not measure
                    accuracy or predict a student outcome.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Field group / source</th>
                          <th>Source key</th>
                          <th>Received</th>
                          <th>Received by</th>
                          <th>Revision</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.metadata
                          .filter(
                            (m) =>
                              m.key === selectedStudent ||
                              (m.feed === "LMS" &&
                                m.key.startsWith(`${selectedStudent}:`)),
                          )
                          .map((m) => (
                            <tr key={`${m.feed}:${m.key}`}>
                              <td>
                                {m.feed === "SIS"
                                  ? "Identity, enrollment, GPA"
                                  : m.feed === "LMS"
                                    ? "Course score and attendance"
                                    : "Library clearance and fines"}{" "}
                                · {m.feed}
                              </td>
                              <td>{m.key}</td>
                              <td>
                                {m.receivedAt
                                  ? formatTime(m.receivedAt)
                                  : "Unknown"}
                              </td>
                              <td>{m.receivedBy}</td>
                              <td>{m.revision || "Legacy"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
              <details className="panel workflow-disclosure">
                <summary>
                  Pipeline run history · {data.runs.length} recent runs
                </summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Finished</th>
                        <th>Processing result</th>
                        <th>Loaded students</th>
                        <th>Quality notices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.runs.map((r) => (
                        <tr key={r.id}>
                          <td>{formatTime(r.endTime)}</td>
                          <td>
                            {r.status === "FAILED"
                              ? "Failed"
                              : r.warnings.length
                                ? "Completed with notices"
                                : "Completed"}
                          </td>
                          <td>{r.recordsLoaded}</td>
                          <td>{r.warnings.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
function QualityDetail({
  issue,
  data,
  canWrite,
  busy,
  save,
  onClose,
}: {
  issue: QualityIssue;
  data: QualityWorkspace;
  canWrite: boolean;
  busy: boolean;
  save: (body: object) => Promise<unknown>;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="panel" aria-label="Quality issue details">
      <div className="panel-header">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {issue.rule.replaceAll("_", " ")}
          </h2>
          <p>
            {issue.feed} · {issue.sourceKey} · First seen{" "}
            {formatTime(issue.firstSeenAt)}
          </p>
        </div>
        <button className="button secondary" onClick={onClose}>
          Close issue details
        </button>
      </div>
      <div className="panel-body">
        <p>
          {issue.status === "Resolved" && "Original finding: "}
          {issue.description}
        </p>
        <p>
          <Badge tone={issue.status === "Resolved" ? "success" : "warning"}>
            {issue.status}
          </Badge>
          {issue.resolvedAt &&
            ` Recheck passed ${formatTime(issue.resolvedAt)}`}
        </p>
        {canWrite && issue.status !== "Resolved" && (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await save({
                  type: "update",
                  id: issue.id,
                  ownerId: f.get("ownerId") || null,
                  status: f.get("status"),
                  note: f.get("note"),
                });
              }}
            >
              <fieldset className="workflow-fields" disabled={busy}>
                <label>
                  Issue steward
                  <select name="ownerId" defaultValue={issue.ownerId || ""}>
                    <option value="">Unassigned</option>
                    {issue.ownerId &&
                      !data.stewards.some((s) => s.id === issue.ownerId) && (
                        <option value={issue.ownerId} disabled>
                          {issue.ownerName} · inactive
                        </option>
                      )}
                    {data.stewards.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Work status
                  <select name="status" defaultValue={issue.status}>
                    <option>Open</option>
                    <option>In progress</option>
                  </select>
                </label>
                <label className="workflow-span">
                  Steward note
                  <textarea
                    name="note"
                    rows={2}
                    maxLength={2000}
                    placeholder="Record the source owner contacted or the correction planned."
                  />
                </label>
              </fieldset>
              <button className="button primary" disabled={busy}>
                Save issue work
              </button>
            </form>
            {issue.rule.startsWith("ORPHAN_") && (
              <form
                className="workflow-relink"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await save({
                    type: "relink",
                    id: issue.id,
                    studentId: new FormData(e.currentTarget).get("studentId"),
                  });
                }}
              >
                <h3>Correct the source identity</h3>
                <p className="small muted">
                  Relink this staged record to an existing SIS student. A
                  destination key collision is rejected. The published master
                  stays unchanged until ETL.
                </p>
                <label>
                  Correct student
                  <select
                    name="studentId"
                    required
                    disabled={busy}
                    defaultValue=""
                  >
                    <option value="">Choose the correct identity</option>
                    {data.students.map((s) => (
                      <option key={s.studentId} value={s.studentId}>
                        {s.fullName} · {s.studentId}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button secondary" disabled={busy}>
                  Stage identity correction
                </button>
              </form>
            )}
          </>
        )}
        <div className="workflow-history">
          <h3>Issue activity</h3>
          {issue.history.length ? (
            issue.history
              .slice()
              .reverse()
              .map((h) => (
                <article key={h.id}>
                  <div className="small muted">
                    {formatTime(h.at)} · {h.actor}
                  </div>
                  <p>{h.text}</p>
                </article>
              ))
          ) : (
            <p className="muted">
              No steward updates yet. Resolution is recorded automatically after
              the source check passes.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
