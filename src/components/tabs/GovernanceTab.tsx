"use client";
import { useState } from "react";
import { ShieldCheck, LockKeyhole, CheckCircle2, Database } from "lucide-react";
import { useEDM } from "@/lib/context/EDMContext";
import {
  Badge,
  EmptyState,
  formatTime,
  PageHeading,
  ReportLink,
} from "@/components/ui";
const permissions = [
  [
    "Dean / Registrar",
    "Full records",
    "Unmasked",
    "Full view",
    "All events",
    "Ingest, ETL & follow-up",
  ],
  [
    "Academic Advisor",
    "All academic records",
    "Last four only",
    "Restricted",
    "Advisor events",
    "Advisor follow-up",
  ],
  [
    "Student",
    "Own linked record",
    "Last four only",
    "Restricted in demo",
    "No access",
    "Read own record",
  ],
  [
    "Compliance Auditor",
    "Pseudonymized summaries",
    "Fully masked",
    "Restricted",
    "All events",
    "Read & export audit",
  ],
];
const labels: Record<string, string> = {
  READ_STUDENT_360: "Student dossier viewed",
  ETL_SYNC_RUN: "ETL completed",
  EXPORT_DATA: "Report exported",
  MASKING_OVERRIDE_ATTEMPT: "Persona / access event",
  IMPORT_DATA: "Source data imported",
  CREATE_INTERVENTION: "Advisor follow-up",
  RESET_DEMO: "Demo restored",
  SIGN_IN: "Account signed in",
  SIGN_OUT: "Account signed out",
};
export function GovernanceTab() {
  const { currentRole, masterRecords, auditLogs, auditIntegrity, accessMode } =
    useEDM();
  const [filter, setFilter] = useState("ALL");
  const sample = masterRecords[0];
  const logs = auditLogs.filter((l) => filter === "ALL" || l.action === filter);
  return (
    <div className="page-stack">
      <PageHeading
        title="Trust is part of the data lifecycle."
        description="Inspect the access policy, see server-applied masking, and trace the operations that created and accessed your data."
        action={
          currentRole !== "STUDENT" ? (
            <ReportLink kind="audit" label="Export audit CSV" />
          ) : undefined
        }
      />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Role-based access policy</h2>
            <p>Application policy for this educational demonstration</p>
          </div>
          <Badge tone="info">
            <ShieldCheck size={13} />
            Enforced in server routes
          </Badge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Student data</th>
                <th>SSN</th>
                <th>Financial aid</th>
                <th>Audit scope</th>
                <th>Write access</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((r, i) => (
                <tr
                  key={r[0]}
                  style={{
                    background:
                      [
                        "DEAN_REGISTRAR",
                        "ACADEMIC_ADVISOR",
                        "STUDENT",
                        "COMPLIANCE_AUDITOR",
                      ][i] === currentRole
                        ? "var(--surface-raised)"
                        : undefined,
                  }}
                >
                  {r.map((c, j) => (
                    <td key={j}>{j === 0 ? <strong>{c}</strong> : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="split-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Field masking in practice</h2>
              <p>Only permitted values arrive in your browser.</p>
            </div>
            <LockKeyhole size={20} className="text-accent" />
          </div>
          <div className="panel-body">
            <p className="small">
              {accessMode === "account"
                ? "Your account role determines this projection. Raw fields are withheld when your role does not permit access."
                : "Change the demo persona in the top bar to compare the same student’s projected record. Raw fields are withheld from restricted personas."}
            </p>
            {sample ? (
              <div className="mask-sample">
                <dl>
                  <div>
                    <dt>Student</dt>
                    <dd>{sample.fullName}</dd>
                  </div>
                  <div>
                    <dt>SSN</dt>
                    <dd className="mono text-warning">{sample.ssn}</dd>
                  </div>
                  <div>
                    <dt>Date of birth</dt>
                    <dd>{sample.dateOfBirth}</dd>
                  </div>
                  <div>
                    <dt>Financial aid</dt>
                    <dd>{sample.financialAidStatus}</dd>
                  </div>
                  <div>
                    <dt>Cumulative GPA</dt>
                    <dd>{sample.cumulativeGpa.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <EmptyState title="No sample record">
                Run the pipeline after importing SIS data.
              </EmptyState>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Governance controls</h2>
              <p>Privacy-inspired controls with inspectable behavior</p>
            </div>
            <Database size={20} className="text-accent" />
          </div>
          <div className="panel-body">
            <ul className="policy-list">
              <li>
                <CheckCircle2 size={15} />
                <span>
                  {accessMode === "account"
                    ? "A revocable HttpOnly session identifies your signed-in account. Its assigned role gates data, writes, and exports."
                    : "HttpOnly session cookies identify the current demonstration persona. Server permissions gate source writes and exports."}
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>
                  Audit entries use full UTC timestamps, SHA-256 chaining, and
                  SQLite triggers that reject edits and deletions.
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>
                  CSV/JSON records are validated before import. Invalid batches
                  are rejected without partial writes.
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>
                  Resetting the demo preserves the audit trail and historical
                  ETL reports.
                </span>
              </li>
            </ul>
            <div style={{ marginTop: 18 }}>
              <Badge tone={auditIntegrity ? "success" : "danger"}>
                {auditIntegrity
                  ? "Audit hash chain verified"
                  : "Audit integrity check failed"}
              </Badge>
            </div>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Audit trail</h2>
            <p>
              {currentRole === "ACADEMIC_ADVISOR"
                ? "Events for the advisor persona"
                : currentRole === "STUDENT"
                  ? "Audit records are restricted to staff"
                  : "Timestamped, append-only event history"}{" "}
              · displayed in Singapore time
            </p>
          </div>
          <select
            aria-label="Filter audit actions"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={currentRole === "STUDENT"}
          >
            <option value="ALL">All actions ({auditLogs.length})</option>
            {Object.entries(labels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {logs.length ? (
          <div className="table-wrap" style={{ maxHeight: 500 }}>
            <table>
              <thead>
                <tr>
                  <th>Timestamp · SGT</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource / details</th>
                  <th>Status</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatTime(l.timestamp)}
                    </td>
                    <td>
                      {l.actorName.split(" (")[0]}
                      <span className="muted">
                        {l.userRole.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{labels[l.action] || l.action}</td>
                    <td>
                      <strong>{l.targetResource}</strong>
                      <span
                        className="muted"
                        style={{ minWidth: 230, maxWidth: 400 }}
                      >
                        {l.details}
                      </span>
                    </td>
                    <td>
                      <Badge
                        tone={
                          l.status === "RESTRICTED_MASKED"
                            ? "warning"
                            : "success"
                        }
                      >
                        {l.status === "RESTRICTED_MASKED"
                          ? "Denied / masked"
                          : l.status === "ALLOWED"
                            ? "Allowed"
                            : "Logged"}
                      </Badge>
                    </td>
                    <td className="mono muted" title={l.hash}>
                      {l.hash?.slice(0, 10)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              currentRole === "STUDENT"
                ? "Audit trail restricted"
                : "No matching audit events"
            }
          >
            {currentRole === "STUDENT"
              ? "Choose a staff persona to inspect the audit trail."
              : "Select another action filter or interact with the workspace to create an event."}
          </EmptyState>
        )}
      </section>
      <div className="inline-note">
        <ShieldCheck size={16} />
        <span>
          FERPA and GDPR inform the course’s governance discussion. This app
          demonstrates selected technical controls; it does not establish
          regulatory compliance.{" "}
          {accessMode === "account"
            ? "Account access uses administrator-provisioned roles. Institutional identity and operational privacy controls remain necessary before handling real student data."
            : "Persona switching is intentionally open in demo mode. Enable account mode to require sign-in and administrator-assigned roles."}
        </span>
      </div>
    </div>
  );
}
