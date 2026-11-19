"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useWorkflowWorkspace } from "@/frontend/lib/useWorkflowWorkspace";
import type {
  RegistrationWorkspace,
  StudentAccessRequest,
} from "@/shared/registration";
import { Badge, EmptyState, formatTime } from "./ui";

export function RegistrationRequests() {
  const state = useWorkflowWorkspace<RegistrationWorkspace>(
    "/api/student-requests",
    true,
  );
  const [filter, setFilter] = useState("Pending");
  const [selected, setSelected] = useState<string | null>(null);
  const data = state.data;
  const chosen = data?.requests.find((r) => r.id === selected);
  return (
    <details className="panel workflow-disclosure workflow-page">
      <summary>
        Student registration requests
        {data
          ? ` · ${data.requests.filter((r) => r.status === "Pending").length} pending`
          : ""}
      </summary>
      <div className="panel-body page-stack">
        <div className="workflow-filters">
          <label>
            Request status
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
              <option>All</option>
            </select>
          </label>
          <button
            className="button secondary"
            disabled={state.loading || state.busy}
            onClick={() => void state.reload()}
          >
            <RefreshCw size={15} />
            Reload requests
          </button>
        </div>
        {state.loading && !data && <p>Loading requests…</p>}
        {state.error && !chosen && (
          <p className="message error" role="alert">
            {state.error}
          </p>
        )}
        {state.message && (
          <p className="message success" role="status">
            {state.message}
          </p>
        )}
        {data && (
          <>
            {data.requests.some(
              (r) => filter === "All" || r.status === filter,
            ) ? (
              <div className="table-wrap">
                <table className="workflow-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Department</th>
                      <th>Verified email</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requests
                      .filter((r) => filter === "All" || r.status === filter)
                      .map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.fullName}</strong>
                            <span className="workflow-secondary">
                              {r.studentId}
                            </span>
                          </td>
                          <td>{r.department}</td>
                          <td>{r.email}</td>
                          <td>
                            <Badge
                              tone={
                                r.status === "Approved"
                                  ? "success"
                                  : r.status === "Rejected"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td>
                            <button
                              className="button secondary"
                              aria-label={`Review registration for ${r.studentId}`}
                              onClick={() => setSelected(r.id)}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No requests in this view">
                Verified requests for new school IDs appear here.
              </EmptyState>
            )}
            {chosen && (
              <RequestReview
                key={chosen.id + chosen.status}
                request={chosen}
                busy={state.busy}
                error={state.error}
                onSave={state.save}
                onClose={() => setSelected(null)}
              />
            )}
          </>
        )}
      </div>
    </details>
  );
}
function RequestReview({
  request: r,
  busy,
  error,
  onSave,
  onClose,
}: {
  request: StudentAccessRequest;
  busy: boolean;
  error: string;
  onSave: (body: object) => Promise<unknown>;
  onClose: () => void;
}) {
  const [decision, setDecision] = useState("approve");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section aria-label="Registration review" className="workflow-history">
      <div className="panel-header">
        <div>
          <h2 ref={heading} tabIndex={-1}>
            {r.fullName}
          </h2>
          <p>
            {r.studentId} · {r.department} · {r.email}
          </p>
        </div>
        <button type="button" className="button quiet" onClick={onClose}>
          Close review
        </button>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      <p className="small">Email verified {formatTime(r.verifiedAt)}.</p>
      {!r.hasSchoolRecord && (
        <p className="message info">
          No published SIS record. Approval grants account access; academic data
          stays unavailable until imported.
        </p>
      )}
      {r.status === "Pending" ? (
        <form
          className="workflow-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            await onSave({ id: r.id, decision, note: form.get("note") });
          }}
        >
          <label>
            Decision
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              disabled={busy}
            >
              <option value="approve">Approve student access</option>
              <option value="reject">Reject request</option>
            </select>
          </label>
          <label className="workflow-span">
            Registrar note
            {decision === "reject" ? " (required)" : " (optional)"}
            <textarea
              name="note"
              required={decision === "reject"}
              minLength={decision === "reject" ? 5 : undefined}
              maxLength={1000}
              disabled={busy}
            />
          </label>
          <p className="small muted workflow-span">
            Confirm enrollment before approving. Notes stay internal.
          </p>
          <button className="button primary" disabled={busy}>
            {busy
              ? "Saving…"
              : decision === "approve"
                ? "Approve student access"
                : "Reject request"}
          </button>
        </form>
      ) : (
        <p className="small">
          {r.status} {r.reviewedAt ? formatTime(r.reviewedAt) : ""} ·{" "}
          {r.reviewedBy}
          {r.reviewNote ? ` · ${r.reviewNote}` : ""}
        </p>
      )}
    </section>
  );
}
