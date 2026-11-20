"use client";
import { useState } from "react";
import { ShieldCheck, LockKeyhole, CheckCircle2, Database } from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import {
  Badge,
  EmptyState,
  formatTime,
  PageHeading,
  ReportLink,
} from "@/frontend/components/ui";
const permissions = [
  [
    "System Admin",
    "No student records",
    "No access",
    "No access",
    "Account events",
    "Staff accounts only",
  ],
  [
    "Registrar",
    "Full records",
    "Unmasked",
    "Full view",
    "All events",
    "Ingest, ETL & follow-up",
  ],
  [
    "Dean",
    "Assigned department only",
    "Last four only",
    "Restricted",
    "Own account events",
    "Department follow-up",
  ],
  [
    "Academic Advisor / Faculty",
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
  LOGIN_FAILED: "Failed sign-in attempt",
  STUDENT_REGISTERED: "Student account activated",
  STUDENT_ACCOUNTS_PROVISIONED: "Student accounts provisioned",
  STUDENT_EMAIL_UPDATED: "Student email updated",
  STUDENT_ACCESS_REQUESTED: "Student access requested",
  STUDENT_ACCESS_APPROVED: "Student access approved",
  STUDENT_ACCESS_REJECTED: "Student access rejected",
  PASSWORD_RESET: "Student password reset",
  ACCOUNT_CREATED: "Staff account created",
  ACCOUNT_UPDATED: "Staff access updated",
  ACCOUNT_STATUS_CHANGED: "Staff status changed",
  STAFF_PASSWORD_RESET: "Staff password reset",
  CASE_CREATED: "Support case created",
  CASE_UPDATED: "Support case updated",
  CASE_ASSIGNED: "Case assignment updated",
  QUALITY_ISSUE_UPDATED: "Quality issue updated",
  QUALITY_ISSUE_RESOLVED: "Quality issue resolved",
  QUALITY_SOURCE_CORRECTED: "Source identity corrected",
};
export function GovernanceTab() {
  const { currentRole, masterRecords, auditLogs, auditIntegrity, accessMode } =
    useEDM();
  const [filter, setFilter] = useState("ALL");
  const personalActivity =
    currentRole === "ACADEMIC_ADVISOR" || currentRole === "DEAN";
  const sample = masterRecords[0];
  const logs = auditLogs.filter((l) => filter === "ALL" || l.action === filter);
  return (
    <div className="page-stack">
      <PageHeading
        title={personalActivity ? "My activity & access" : "Governance & audit"}
        action={
          currentRole !== "STUDENT" ? (
            <ReportLink kind="audit" label="Export audit CSV" />
          ) : undefined
        }
      />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Access policy</h2>
          </div>
          <Badge tone="info">
            <ShieldCheck size={13} />
            Role-based access
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
                        "SYSTEM_ADMIN",
                        "REGISTRAR",
                        "DEAN",
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
              <h2>Field masking</h2>
            </div>
            <LockKeyhole size={20} className="text-accent" />
          </div>
          <div className="panel-body">
            <p className="small">
              {accessMode === "account"
                ? "Fields shown for your role."
                : "Switch demo persona to compare access."}
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
                    <dt>Cumulative GWA</dt>
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
            </div>
            <Database size={20} className="text-accent" />
          </div>
          <div className="panel-body">
            <ul className="policy-list">
              <li>
                <CheckCircle2 size={15} />
                <span>
                  FERPA controls: server role checks, SSN/DOB/financial-aid
                  masking, department scope, and student self-access.
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>
                  GDPR principles: data minimization via server projections,
                  pseudonymized auditor summaries, and purpose-limited staff
                  notes.
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>
                  Hash-chained audit logs cannot be edited or deleted.
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>
                  Invalid imports are rejected in full; valid formats are
                  standardized during ETL.
                </span>
              </li>
              <li>
                <CheckCircle2 size={15} />
                <span>Demo resets preserve audit and ETL history.</span>
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
              {personalActivity
                ? "Events for your account"
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
          Demonstration controls, not certified FERPA/GDPR compliance.
          {accessMode !== "account" && " Demo personas do not require sign-in."}
        </span>
      </div>
    </div>
  );
}
