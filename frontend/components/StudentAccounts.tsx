"use client";

import { useState } from "react";
import { useWorkflowWorkspace } from "@/frontend/lib/useWorkflowWorkspace";
import type { StudentAccountsWorkspace } from "@/shared/registration";
import { RegistrationRequests } from "./RegistrationRequests";

export function StudentAccounts() {
  const state = useWorkflowWorkspace<StudentAccountsWorkspace>(
    "/api/student-accounts",
    true,
  );
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);

  return (
    <details className="panel workflow-disclosure workflow-page">
      <summary>Student accounts</summary>
      <div className="panel-body page-stack">
        {state.loading && !state.data && <p>Loading accounts…</p>}
        {state.data && (
          <p className="small">
            {state.data.pending} pending activation · {state.data.active} active
          </p>
        )}
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
        <div className="workflow-filters">
          <button
            type="button"
            className="button secondary"
            disabled={state.busy || state.loading}
            onClick={() => void state.save({ type: "provision" })}
          >
            Provision from SIS
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={state.busy || state.loading}
            onClick={() => void state.reload()}
          >
            Refresh counts
          </button>
        </div>
        <form
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
                maxLength={60}
                required
                disabled={state.busy}
              />
            </label>
            <label>
              Enrollment email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
        <RegistrationRequests />
      </div>
    </details>
  );
}
