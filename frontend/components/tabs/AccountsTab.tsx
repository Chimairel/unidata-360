"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import { STAFF_ROLES, ROLE_LABELS } from "@/shared/accounts";
import { DEPARTMENTS } from "@/shared/school";
import type { AuditLogEntry, StaffAccount } from "@/shared/types";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { Badge, EmptyState, Modal, PageHeading, formatTime } from "../ui";

type StaffRole = (typeof STAFF_ROLES)[number];
async function requestAccounts(body?: object, signal?: AbortSignal) {
  const response = await fetch("/api/accounts", {
    cache: "no-store",
    signal,
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not load staff accounts.");
  return result as {
    accounts: StaffAccount[];
    activity: AuditLogEntry[];
    message?: string;
  };
}
function StaffEditor({
  account,
  busy,
  serverError,
  onSave,
  onClose,
}: {
  serverError: string;
  account?: StaffAccount;
  busy: boolean;
  onSave: (body: object) => Promise<boolean>;
  onClose: () => void;
}) {
  const [role, setRole] = useState<StaffRole>(
    (account?.role as StaffRole) || "ACADEMIC_ADVISOR",
  );
  const focus = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    focus.current?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    if (!account && data.get("password") !== data.get("confirmation")) {
      setError("Passwords do not match.");
      return;
    }
    await onSave({
      type: account ? "update" : "create",
      ...(account
        ? { id: account.id }
        : { email: data.get("email"), password: data.get("password") }),
      displayName: data.get("displayName"),
      role,
      ...(role === "DEAN" ? { department: data.get("department") } : {}),
    });
  }
  return (
    <section
      className="panel account-editor"
      aria-label={account ? "Edit staff access" : "Create staff account"}
    >
      <div className="panel-header">
        <div>
          <h2>{account ? "Edit staff access" : "Create staff account"}</h2>
          <p>
            {account
              ? `${account.email} · Updating access signs out existing sessions.`
              : "The Registrar provisions student accounts from SIS."}
          </p>
        </div>
      </div>
      <form className="panel-body" onSubmit={submit}>
        {(error || serverError) && (
          <p className="message error" role="alert">
            {error || serverError}
          </p>
        )}
        <fieldset disabled={busy} className="account-fields">
          <label>
            Full name
            <input
              ref={focus}
              name="displayName"
              required
              maxLength={100}
              defaultValue={account?.displayName}
              autoComplete="off"
            />
          </label>
          {!account && (
            <label>
              Staff email
              <input
                name="email"
                type="email"
                required
                maxLength={200}
                autoComplete="off"
                placeholder="name@gmail.com"
              />
            </label>
          )}
          <label>
            Role
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {role === "DEAN" && (
            <label>
              Dean department
              <select
                name="department"
                required
                defaultValue={account?.department || ""}
              >
                <option value="" disabled>
                  Select department
                </option>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          )}
          {!account && (
            <>
              <label>
                Initial password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  aria-describedby="staff-password-help"
                />
              </label>
              <label>
                Confirm initial password
                <input
                  name="confirmation"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            </>
          )}
        </fieldset>
        {!account && (
          <p className="small muted" id="staff-password-help">
            12–128 characters. Share credentials privately.
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : account ? "Save access" : "Create account"}
          </button>
        </div>
      </form>
    </section>
  );
}
function PasswordEditor({
  account,
  busy,
  serverError,
  onSave,
  onClose,
}: {
  serverError: string;
  account: StaffAccount;
  busy: boolean;
  onSave: (body: object) => Promise<boolean>;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title="Reset staff password" onClose={onClose}>
      <form
        className="panel-body"
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setError("");
          if (data.get("password") !== data.get("confirmation")) {
            setError("Passwords do not match.");
            return;
          }
          await onSave({
            type: "password",
            id: account.id,
            password: data.get("password"),
          });
        }}
      >
        <p>
          <strong>{account.email}</strong>. This signs out existing sessions;
          account status is unchanged.
        </p>
        {(error || serverError) && (
          <p className="message error" role="alert">
            {error || serverError}
          </p>
        )}
        <fieldset className="account-fields" disabled={busy}>
          <label>
            New staff password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmation"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        </fieldset>
        <p className="small muted">12–128 characters.</p>
        <div className="form-actions">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function AccountsTab() {
  const { auditLogs } = useEDM();
  const [activity, setActivity] = useState(auditLogs);
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [roleFilter, setRoleFilter] = useState("ALL"),
    [status, setStatus] = useState("ALL");
  const [editor, setEditor] = useState<StaffAccount | "create" | null>(null);
  const [reset, setReset] = useState<StaffAccount | null>(null),
    [toggle, setToggle] = useState<StaffAccount | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    void requestAccounts(undefined, abort.signal)
      .then((r) => {
        if (abort.signal.aborted) return;
        setAccounts(r.accounts);
        setActivity(r.activity);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);
  async function reload() {
    setLoading(true);
    setError("");
    try {
      const result = await requestAccounts();
      setAccounts(result.accounts);
      setActivity(result.activity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts.");
    } finally {
      setLoading(false);
    }
  }
  async function save(body: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestAccounts(body);
      setAccounts(result.accounts);
      setActivity(result.activity);
      setMessage(result.message || "Account updated.");
      setEditor(null);
      setReset(null);
      setToggle(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save account.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const staff = accounts.filter((a) => a.role !== "SYSTEM_ADMIN");
  const filtered = accounts.filter(
    (a) =>
      `${a.displayName} ${a.email} ${a.department || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()) &&
      (roleFilter === "ALL" || a.role === roleFilter) &&
      (status === "ALL" || a.active === (status === "active")),
  );
  return (
    <div className="page-stack accounts-workspace">
      <PageHeading
        title="Staff accounts"
        action={
          <button
            className="button primary"
            disabled={busy || loading}
            onClick={() => {
              setEditor("create");
              setError("");
              setMessage("");
            }}
          >
            <Plus size={17} />
            Create staff account
          </button>
        }
      />
      {(message || (error && !editor && !reset && !toggle)) && (
        <div
          className={`message ${error ? "error" : "success"}`}
          role={error ? "alert" : "status"}
        >
          {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{error || message}</span>
          {error && (
            <Link href="/login" className="text-link">
              Sign in
            </Link>
          )}
        </div>
      )}
      <dl className="summary-strip">
        <div className="summary-item">
          <dt>Staff accounts</dt>
          <dd>{loading ? "—" : staff.length}</dd>
        </div>
        <div className="summary-item">
          <dt>Active staff</dt>
          <dd>{loading ? "—" : staff.filter((a) => a.active).length}</dd>
        </div>
        <div className="summary-item">
          <dt>Disabled staff</dt>
          <dd>{loading ? "—" : staff.filter((a) => !a.active).length}</dd>
        </div>
      </dl>
      {editor && (
        <StaffEditor
          key={editor === "create" ? "create" : editor.id}
          account={editor === "create" ? undefined : editor}
          busy={busy}
          serverError={error}
          onSave={save}
          onClose={() => setEditor(null)}
        />
      )}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Staff directory</h2>
            <p>
              Admin accounts are protected. Student enrollment &amp; portal
              accounts are managed by the Registrar from SIS.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => void reload()}
            disabled={loading || busy}
          >
            <RefreshCw size={15} />
            Reload
          </button>
        </div>
        <div className="account-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search staff accounts"
              placeholder="Search name, email or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter staff role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All roles</option>
            {["SYSTEM_ADMIN", ...STAFF_ROLES].map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter account status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        {loading ? (
          <div className="panel-body" role="status" aria-busy="true">
            Loading staff accounts…
          </div>
        ) : !filtered.length ? (
          <EmptyState
            title={error ? "Accounts unavailable" : "No accounts match"}
          >
            {error
              ? "Reload the directory or sign in with your System Admin account."
              : "Try a different name, role or status filter."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.displayName}</strong>
                      <span className="account-email">{account.email}</span>
                    </td>
                    <td>{ROLE_LABELS[account.role]}</td>
                    <td>{account.department || "School-wide"}</td>
                    <td>
                      <Badge tone={account.active ? "success" : "neutral"}>
                        {account.active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td>
                      {account.role === "SYSTEM_ADMIN" ? (
                        <span className="small muted">
                          Protected administrator
                        </span>
                      ) : (
                        <div className="account-actions">
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              setEditor(account);
                              setError("");
                              setMessage("");
                            }}
                            aria-label={`Edit access for ${account.email}`}
                          >
                            Edit access
                          </button>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              setReset(account);
                              setError("");
                              setMessage("");
                            }}
                            aria-label={`Reset password for ${account.email}`}
                          >
                            Reset password
                          </button>
                          <button
                            className="button quiet"
                            disabled={busy}
                            onClick={() => {
                              setToggle(account);
                              setError("");
                              setMessage("");
                            }}
                            aria-label={`${account.active ? "Disable" : "Activate"} ${account.email}`}
                          >
                            {account.active ? "Disable" : "Activate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Account activity</h2>
          </div>
        </div>
        {activity.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {activity.slice(0, 30).map((entry) => (
                  <tr key={entry.id}>
                    <td className="nowrap">{formatTime(entry.timestamp)}</td>
                    <td>{entry.actorName}</td>
                    <td>{entry.action.replaceAll("_", " ").toLowerCase()}</td>
                    <td>{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No account activity yet">
            Staff account changes will appear here.
          </EmptyState>
        )}
      </section>
      {reset && (
        <PasswordEditor
          account={reset}
          busy={busy}
          serverError={error}
          onSave={save}
          onClose={() => setReset(null)}
        />
      )}
      {toggle && (
        <Modal
          title={`${toggle.active ? "Disable" : "Activate"} staff account`}
          onClose={() => setToggle(null)}
        >
          <div className="panel-body">
            {error && (
              <p className="message error" role="alert">
                {error}
              </p>
            )}
            <p>
              {toggle.active ? "Disable access for" : "Restore access for"}{" "}
              <strong>{toggle.email}</strong>?
            </p>
            <p className="small muted">
              {toggle.active
                ? "Signs out all sessions and blocks sign-in. You can reactivate later."
                : "Restores sign-in with the existing password and role."}
            </p>
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setToggle(null)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void save({
                    type: "status",
                    id: toggle.id,
                    active: !toggle.active,
                  })
                }
              >
                {busy
                  ? "Saving…"
                  : toggle.active
                    ? "Disable account"
                    : "Activate account"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
