"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, ArrowLeft } from "lucide-react";
import type { AdvisingCase, CaseWorkspace } from "@/shared/types";
import { caseSummary } from "@/shared/workflows";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { useWorkflowWorkspace } from "@/frontend/lib/useWorkflowWorkspace";
import { Badge, EmptyState, PageHeading, formatTime } from "../ui";

type Save = (body: object) => Promise<boolean>;
function CaseEditor({
  data,
  studentId,
  busy,
  onSave,
  onClose,
}: {
  data: CaseWorkspace;
  studentId?: string;
  busy: boolean;
  onSave: Save;
  onClose: () => void;
}) {
  const [student, setStudent] = useState(studentId || "");
  const firstField = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    firstField.current?.focus();
  }, []);
  const department = data.students.find(
    (s) => s.studentId === student,
  )?.department;
  const staff = data.assignees.filter(
    (a) => a.role !== "DEAN" || a.department === department,
  );
  return (
    <section className="panel" aria-label="Create advising case">
      <div className="panel-header">
        <div>
          <h2>Create a support case</h2>
          <p>
            Choose a student and an active staff member responsible for the next
            action.
          </p>
        </div>
      </div>
      <form
        className="panel-body"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (
            await onSave({
              type: "create",
              studentId: student,
              assigneeId: f.get("assigneeId"),
              reason: f.get("reason"),
              priority: f.get("priority"),
              dueDate: f.get("dueDate") || null,
            })
          )
            onClose();
        }}
      >
        <fieldset className="workflow-fields" disabled={busy}>
          <label>
            Student
            <select
              ref={firstField}
              value={student}
              onChange={(e) => setStudent(e.target.value)}
              required
            >
              <option value="">Select a student</option>
              {data.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.fullName} · {s.department} · {s.studentId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assigned staff
            <select
              name="assigneeId"
              key={student}
              required
              defaultValue={
                staff.some((s) => s.id === data.currentUserId)
                  ? data.currentUserId
                  : ""
              }
            >
              <option value="">Select responsible staff</option>
              {staff.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName} · {a.role.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue="Normal">
              <option>Normal</option>
              <option>High</option>
            </select>
          </label>
          <label>
            Due date
            <input name="dueDate" type="date" />
          </label>
          <label className="workflow-span">
            Reason for support
            <textarea
              name="reason"
              rows={3}
              required
              minLength={5}
              maxLength={1000}
              placeholder="Describe the concern and the next action needed."
            />
          </label>
        </fieldset>
        <p className="small muted">
          One support case per student preserves a continuous history. Reopen an
          existing resolved case when further support is needed. Staff notes
          remain internal.
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || !staff.length}>
            {busy ? "Creating…" : "Create and assign case"}
          </button>
        </div>
      </form>
    </section>
  );
}
function CaseDetail({
  entry,
  data,
  busy,
  onSave,
  onClose,
}: {
  entry: AdvisingCase;
  data: CaseWorkspace;
  busy: boolean;
  onSave: Save;
  onClose: () => void;
}) {
  const { currentRole } = useEDM();
  const [status, setStatus] = useState(entry.status);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const student = data.students.find((s) => s.studentId === entry.studentId);
  const canEdit =
    !!entry.assigneeId &&
    (currentRole !== "ACADEMIC_ADVISOR" ||
      entry.assigneeId === data.currentUserId);
  const staff = data.assignees.filter(
    (a) => a.role !== "DEAN" || a.department === student?.department,
  );
  return (
    <section className="panel" aria-label="Case details">
      <div className="panel-header">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {student?.fullName || entry.studentId}
          </h2>
          <p>
            {entry.studentId} · Opened {formatTime(entry.createdAt)} ·{" "}
            {entry.id.slice(0, 8)}
          </p>
        </div>
        <button className="button secondary" onClick={onClose}>
          <ArrowLeft size={15} />
          Back to cases
        </button>
      </div>
      <div className="panel-body">
        <p>{entry.reason}</p>
        <div className="workflow-meta">
          <Badge tone={entry.status === "Resolved" ? "success" : "warning"}>
            {entry.status}
          </Badge>
          <span>{entry.advisorName}</span>
          {entry.dueDate && <span>Due {entry.dueDate}</span>}
        </div>
        <form
          className="workflow-assignment"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave({
              type: "assign",
              id: entry.id,
              assigneeId: new FormData(e.currentTarget).get("assigneeId"),
            });
          }}
        >
          <label>
            Responsible staff
            <select
              name="assigneeId"
              defaultValue={
                staff.some((s) => s.id === entry.assigneeId)
                  ? entry.assigneeId
                  : ""
              }
              required
              disabled={busy || (!canEdit && !!entry.assigneeId)}
            >
              <option value="">Assign an active staff member</option>
              {staff.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            disabled={busy || (!canEdit && !!entry.assigneeId)}
          >
            Save assignment
          </button>
        </form>
        {!canEdit && (
          <p className="message info">
            {entry.assigneeId
              ? "This case is assigned to another staff member. You can review the case you opened; the assigned person or school leadership manages its follow-up."
              : "Assign an active responsible staff member before recording follow-up."}
          </p>
        )}
        <div className="workflow-detail-grid">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await onSave({
                type: "update",
                id: entry.id,
                status,
                priority: f.get("priority"),
                dueDate: f.get("dueDate") || null,
                note: f.get("note"),
                outcome: f.get("outcome") || "",
              });
            }}
          >
            <h3>Record follow-up</h3>
            <fieldset className="workflow-fields" disabled={busy || !canEdit}>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as AdvisingCase["status"])
                  }
                >
                  <option>Open</option>
                  <option>In progress</option>
                  <option>Resolved</option>
                </select>
              </label>
              <label>
                Priority
                <select name="priority" defaultValue={entry.priority}>
                  <option>Normal</option>
                  <option>High</option>
                </select>
              </label>
              <label>
                Due date
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={entry.dueDate}
                />
              </label>
              <label className="workflow-span">
                Internal follow-up note
                <textarea
                  name="note"
                  rows={4}
                  maxLength={4000}
                  required={
                    entry.status === "Resolved" && status !== "Resolved"
                  }
                  minLength={
                    entry.status === "Resolved" && status !== "Resolved"
                      ? 5
                      : undefined
                  }
                  placeholder={
                    entry.status === "Resolved"
                      ? "Explain any reason to reopen this case."
                      : "Record the contact attempt, support provided or next action."
                  }
                />
              </label>
              {status === "Resolved" && (
                <label className="workflow-span">
                  Resolution outcome
                  <textarea
                    name="outcome"
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    defaultValue={entry.outcome}
                    placeholder="Explain what was completed and the outcome of support."
                  />
                </label>
              )}
            </fieldset>
            <button className="button primary" disabled={busy || !canEdit}>
              {busy ? "Saving…" : "Save case"}
            </button>
          </form>
          <div className="workflow-history">
            <h3>Notes and activity</h3>
            {[
              ...entry.notes.map((n) => ({ ...n, kind: "Note" })),
              ...entry.history.map((n) => ({ ...n, kind: "Activity" })),
            ]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((n) => (
                <article key={n.id}>
                  <div className="small muted">
                    {n.kind} · {formatTime(n.at)} · {n.actor}
                  </div>
                  <p>{n.text}</p>
                </article>
              ))}
            {!entry.notes.length && !entry.history.length && (
              <p className="muted">
                This referral predates case tracking. Assign staff and record
                the next action to start its activity history.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
export function CasesTab({ initialStudentId }: { initialStudentId?: string }) {
  const { accessMode, currentRole, departmentScope, updateCaseSummaries } =
    useEDM();
  const state = useWorkflowWorkspace<CaseWorkspace>(
    "/api/cases",
    accessMode === "account",
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Active");
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(!!initialStudentId);
  const [selected, setSelected] = useState<string | null>(null);
  const [dismissIntent, setDismissIntent] = useState(false);
  const data = state.data;
  const entry = data?.cases.find((c) =>
    selected
      ? c.id === selected
      : !dismissIntent && c.studentId === initialStudentId,
  );
  async function save(body: object) {
    const result = await state.save(body);
    if (result) {
      updateCaseSummaries(result.cases.map(caseSummary), result.currentUserId);
      return true;
    }
    return false;
  }
  const name = (id: string) =>
    data?.students.find((s) => s.studentId === id)?.fullName || id;
  const shown =
    data?.cases.filter(
      (c) =>
        (status === "All" ||
          (status === "Active"
            ? c.status !== "Resolved"
            : c.status === status)) &&
        (!mine || c.assigneeId === data.currentUserId) &&
        `${name(c.studentId)} ${c.studentId} ${c.reason} ${c.advisorName}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  return (
    <div className="page-stack workflow-page">
      <PageHeading
        title="Advising cases"
        description={
          currentRole === "DEAN"
            ? `Coordinate student support within ${departmentScope}. Track responsibility, follow-up and outcomes.`
            : "Turn a concern into owned work. Record follow-up, track due dates and close the case with an outcome."
        }
        action={
          accessMode === "account" && (
            <button
              className="button primary"
              disabled={state.busy || !data}
              onClick={() => {
                setSelected(null);
                setDismissIntent(true);
                setCreating(true);
              }}
            >
              <Plus size={16} />
              Create case
            </button>
          )
        }
      />
      {accessMode !== "account" ? (
        <section className="panel panel-body">
          <h2>Use a staff account for case management</h2>
          <p>
            Cases link to real staff identities. Sign in as Registrar, Dean or
            Academic Advisor to manage assignments and private notes.
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
              <p>Loading permitted cases…</p>
            </div>
          )}
          {data && (
            <>
              <p className="workflow-scope">
                {data.cases.filter((c) => c.status !== "Resolved").length}{" "}
                active ·{" "}
                {data.cases.filter((c) => c.status === "Resolved").length}{" "}
                resolved ·{" "}
                {
                  data.cases.filter(
                    (c) =>
                      c.status !== "Resolved" &&
                      c.dueDate &&
                      c.dueDate <
                        new Date().toLocaleDateString("en-CA", {
                          timeZone: "Asia/Singapore",
                        }),
                  ).length
                }{" "}
                overdue. Student accounts cannot access these notes.
              </p>
              {entry ? (
                <CaseDetail
                  key={`${entry.id}:${entry.updatedAt}`}
                  entry={entry}
                  data={data}
                  busy={state.busy}
                  onSave={save}
                  onClose={() => {
                    setSelected(null);
                    setCreating(false);
                    setDismissIntent(true);
                  }}
                />
              ) : (
                <>
                  {creating && (
                    <CaseEditor
                      data={data}
                      studentId={!dismissIntent ? initialStudentId : undefined}
                      busy={state.busy}
                      onSave={save}
                      onClose={() => setCreating(false)}
                    />
                  )}
                  <section className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>
                          {currentRole === "ACADEMIC_ADVISOR"
                            ? "Your cases and unassigned referrals"
                            : "Case queue"}
                        </h2>
                        <p>
                          Open the case to review its history or record the next
                          action.
                        </p>
                      </div>
                      <button
                        className="button secondary"
                        disabled={state.loading || state.busy}
                        onClick={() => void state.reload()}
                      >
                        <RefreshCw size={15} />
                        Reload
                      </button>
                    </div>
                    <div className="workflow-filters">
                      <label>
                        Search cases
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Student, reason or staff…"
                        />
                      </label>
                      <label>
                        Case status
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
                      <label className="workflow-check">
                        <input
                          type="checkbox"
                          checked={mine}
                          onChange={(e) => setMine(e.target.checked)}
                        />
                        Assigned to me
                      </label>
                    </div>
                    {shown.length ? (
                      <div className="table-wrap">
                        <table className="workflow-table">
                          <thead>
                            <tr>
                              <th>Student / concern</th>
                              <th>Responsible staff</th>
                              <th>Due date</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shown.map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <strong>{name(c.studentId)}</strong>
                                  <span className="workflow-secondary">
                                    {c.studentId} · {c.reason}
                                  </span>
                                  {c.priority === "High" && (
                                    <Badge tone="warning">High priority</Badge>
                                  )}
                                </td>
                                <td>
                                  {c.assigneeId
                                    ? c.advisorName
                                    : "Unassigned referral"}
                                </td>
                                <td>{c.dueDate || "Not set"}</td>
                                <td>
                                  <Badge
                                    tone={
                                      c.status === "Resolved"
                                        ? "success"
                                        : "warning"
                                    }
                                  >
                                    {c.status}
                                  </Badge>
                                </td>
                                <td>
                                  <button
                                    className="button secondary"
                                    onClick={() => {
                                      setSelected(c.id);
                                      setCreating(false);
                                    }}
                                    aria-label={`Open case for ${name(c.studentId)}`}
                                  >
                                    Open case
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyState title="No cases in this view">
                        Adjust the filters or create a case for a student who
                        needs support.
                      </EmptyState>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
