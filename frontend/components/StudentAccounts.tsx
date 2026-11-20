"use client";

import { useRef, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { useWorkflowWorkspace } from "@/frontend/lib/useWorkflowWorkspace";
import type {
  StudentAccountSummary,
  StudentAccountsWorkspace,
} from "@/shared/registration";
import { Badge, EmptyState, Modal } from "./ui";
import { RegistrationRequests } from "./RegistrationRequests";

type StatusFilter = "ALL" | "pending" | "active" | "disabled";

export function StudentAccounts() {
  const [opened, setOpened] = useState(false);
  const state = useWorkflowWorkspace<StudentAccountsWorkspace>(
    "/api/student-accounts",
    opened,
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);

  const [resetTarget, setResetTarget] = useState<StudentAccountSummary | null>(
    null,
  );
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [statusTarget, setStatusTarget] =
    useState<StudentAccountSummary | null>(null);

  const emailFormRef = useRef<HTMLFormElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const students = state.data?.students || [];
  const filtered = students.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      `${item.displayName} ${item.studentId} ${item.email} ${item.department || ""}`
        .toLowerCase()
        .includes(query);
    if (!matchesQuery) return false;
    if (statusFilter === "pending")
      return item.active && item.activationRequired;
    if (statusFilter === "active")
      return item.active && !item.activationRequired;
    if (statusFilter === "disabled") return !item.active;
    return true;
  });

  const startEditEmail = (account: StudentAccountSummary) => {
    setStudentId(account.studentId);
    setEmail(account.email);
    setIdentityConfirmed(false);
    emailFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    setTimeout(() => emailInputRef.current?.focus(), 120);
  };

  return (
    <details
      className="panel workflow-disclosure workflow-page"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary>Student accounts</summary>
      <div className="panel-body page-stack">
        {opened && !state.data && !state.error && (
          <p>Loading student accounts…</p>
        )}
        {state.data && (
          <p className="small">
            <strong>{state.data.pending}</strong> pending (123456) ·{" "}
            <strong>{state.data.active}</strong> active
            {state.data.disabled > 0 && (
              <>
                {" "}
                · <strong>{state.data.disabled}</strong> disabled
              </>
            )}
          </p>
        )}
        {state.error && !resetTarget && !statusTarget && (
          <p className="message error" role="alert">
            {state.error}
          </p>
        )}
        {state.message && (
          <p className="message success" role="status">
            {state.message}
          </p>
        )}
        <div className="workflow-filters">
          <button
            type="button"
            className="button secondary"
            disabled={state.busy || !state.data}
            onClick={() => void state.save({ type: "provision" })}
          >
            Provision from SIS
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={state.busy || state.loading || !opened}
            onClick={() => void state.reload()}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="account-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search student accounts"
              placeholder="Search name, School ID, email or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter student account status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">All statuses ({students.length})</option>
            <option value="pending">
              Pending (123456) ({state.data?.pending ?? 0})
            </option>
            <option value="active">Active ({state.data?.active ?? 0})</option>
            <option value="disabled">
              Disabled ({state.data?.disabled ?? 0})
            </option>
          </select>
        </div>

        {state.data && !filtered.length ? (
          <EmptyState title="No student accounts match">
            {students.length
              ? "Try a different search term or status filter."
              : "Import enrolled students in Pipeline, then click Provision from SIS."}
          </EmptyState>
        ) : (
          filtered.length > 0 && (
            <div className="student-account-list">
              {filtered.map((account) => (
                <div key={account.id} className="student-account-row">
                  <div className="student-account-meta">
                    <div className="student-account-head">
                      <strong>{account.displayName}</strong>
                      {!account.active ? (
                        <Badge tone="neutral">Disabled</Badge>
                      ) : account.activationRequired ? (
                        <Badge tone="warning">Pending (123456)</Badge>
                      ) : (
                        <Badge tone="success">Active</Badge>
                      )}
                    </div>
                    <span className="small muted">
                      <span className="mono">{account.studentId}</span>
                      {account.department ? ` · ${account.department}` : ""} ·{" "}
                      {account.email}
                    </span>
                  </div>
                  <div className="student-account-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={state.busy || !account.active}
                      onClick={() => startEditEmail(account)}
                    >
                      Edit email
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={state.busy || !account.active}
                      onClick={() => {
                        setResetTarget(account);
                        setResetConfirmed(false);
                      }}
                    >
                      Reset to 123456
                    </button>
                    <button
                      type="button"
                      className="button quiet"
                      disabled={state.busy}
                      onClick={() => setStatusTarget(account)}
                    >
                      {account.active ? "Disable" : "Re-enable"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <form
          ref={emailFormRef}
          className="page-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await state.save({
                type: "update-email",
                studentId,
                email,
                identityConfirmed,
              })
            ) {
              setStudentId("");
              setEmail("");
              setIdentityConfirmed(false);
            }
          }}
        >
          <h3>Update student email</h3>
          <div className="workflow-fields">
            <label>
              School ID
              <input
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                placeholder="20221010"
                maxLength={60}
                required
                disabled={state.busy}
              />
            </label>
            <label>
              Enrollment email
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@gmail.com"
                maxLength={200}
                required
                disabled={state.busy}
              />
            </label>
          </div>
          <label className="student-email-confirm">
            <input
              type="checkbox"
              checked={identityConfirmed}
              onChange={(event) => setIdentityConfirmed(event.target.checked)}
              required
              disabled={state.busy}
            />
            I verified the student’s identity.
          </label>
          <div>
            <button
              className="button primary"
              disabled={state.busy || !identityConfirmed}
            >
              Save email
            </button>
          </div>
        </form>
        {opened && <RegistrationRequests />}
      </div>

      {resetTarget && (
        <Modal
          title="Reset student password to 123456"
          onClose={() => {
            setResetTarget(null);
            setResetConfirmed(false);
          }}
        >
          <div className="panel-body page-stack">
            {state.error && (
              <p className="message error" role="alert">
                {state.error}
              </p>
            )}
            <p>
              Reset portal password for{" "}
              <strong>{resetTarget.displayName}</strong> (
              <span className="mono">{resetTarget.studentId}</span>) back to the
              default password (<strong>123456</strong>)?
            </p>
            <p className="small muted">
              This signs out all active sessions, unlocks failed login attempts,
              and requires the student to confirm their email and set a new
              personal password on their next sign-in.
            </p>
            <label className="student-email-confirm">
              <input
                type="checkbox"
                checked={resetConfirmed}
                onChange={(e) => setResetConfirmed(e.target.checked)}
                disabled={state.busy}
              />
              I verified the student’s school ID in person.
            </label>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={state.busy}
                onClick={() => {
                  setResetTarget(null);
                  setResetConfirmed(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                disabled={state.busy || !resetConfirmed}
                onClick={async () => {
                  if (
                    await state.save({
                      type: "reset-default",
                      studentId: resetTarget.studentId,
                      identityConfirmed: true,
                    })
                  ) {
                    setResetTarget(null);
                    setResetConfirmed(false);
                  }
                }}
              >
                {state.busy ? "Resetting…" : "Reset to 123456"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {statusTarget && (
        <Modal
          title={`${statusTarget.active ? "Disable" : "Re-enable"} student portal account`}
          onClose={() => setStatusTarget(null)}
        >
          <div className="panel-body page-stack">
            {state.error && (
              <p className="message error" role="alert">
                {state.error}
              </p>
            )}
            <p>
              {statusTarget.active
                ? "Suspend portal sign-in for"
                : "Restore portal sign-in for"}{" "}
              <strong>{statusTarget.displayName}</strong> (
              <span className="mono">{statusTarget.studentId}</span>)?
            </p>
            <p className="small muted">
              {statusTarget.active
                ? "Signs out all active sessions and blocks student login until re-enabled. Their academic record in SIS is preserved."
                : "Restores sign-in with the student’s existing password and activation state."}
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                disabled={state.busy}
                onClick={() => setStatusTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                disabled={state.busy}
                onClick={async () => {
                  if (
                    await state.save({
                      type: "status",
                      studentId: statusTarget.studentId,
                      active: !statusTarget.active,
                    })
                  ) {
                    setStatusTarget(null);
                  }
                }}
              >
                {state.busy
                  ? "Saving…"
                  : statusTarget.active
                    ? "Disable account"
                    : "Re-enable account"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </details>
  );
}
