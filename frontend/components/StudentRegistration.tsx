"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { AccountHeader } from "./AccountHeader";
import { DEPARTMENTS, type Department } from "@/shared/school";

type Stage = "request" | "sent" | "password" | "complete" | "approval";
export function StudentRegistration({
  purpose = "registration",
}: { purpose?: "registration" | "recovery" } = {}) {
  const recovery = purpose === "recovery";
  const [stage, setStage] = useState<Stage>("request");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState<Department | "">("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    const readFragment = () => {
      if (!active) return;
      const value = new URLSearchParams(window.location.hash.slice(1)).get(
        "token",
      );
      if (!value) return;
      window.history.replaceState(null, "", window.location.pathname);
      if (/^[a-f0-9]{64}$/.test(value)) {
        setToken(value);
        setStage("password");
      } else setError("This link is invalid. Request a new link below.");
    };
    window.addEventListener("hashchange", readFragment);
    queueMicrotask(readFragment);
    return () => {
      active = false;
      window.removeEventListener("hashchange", readFragment);
    };
  }, []);
  useEffect(() => {
    if (stage !== "request") heading.current?.focus();
  }, [stage]);

  const titles = {
    request: recovery
      ? "Reset your student password"
      : "Create your student account",
    sent: preview ? "Local email preview" : "Check your email",
    password: recovery ? "Choose a new password" : "Choose your password",
    complete: recovery ? "Your password is updated" : "Your account is ready",
    approval: "Awaiting Registrar approval",
  };
  const descriptions = {
    request: recovery
      ? "Enter your school ID and the email registered to your student account."
      : "Use your school details. New IDs need Registrar approval.",
    sent: preview
      ? "Eligible links are saved locally, not emailed. Links expire in 30 minutes."
      : recovery
        ? "If your details match, you’ll receive a reset link valid for 30 minutes."
        : "If your record is eligible, you’ll receive a verification link valid for 30 minutes.",
    password: recovery
      ? "Choose a new password. This will sign out your existing account sessions."
      : "Choose a password to finish email verification.",
    complete: recovery
      ? "Sign in with your school ID and new password. Previous sessions have been signed out."
      : "Sign in with your school ID and password.",
    approval:
      "Your email is verified. You can sign in after the Registrar approves your request.",
  };
  return (
    <div className="account-page">
      <AccountHeader current={recovery ? "login" : "register"} />
      <main className="sign-in-shell">
        <section className="sign-in-content">
          <div className="panel sign-in-panel">
            <div className="panel-body">
              {stage === "complete" ? (
                <CheckCircle2 size={24} />
              ) : (
                <Mail size={24} />
              )}
              <h1 ref={heading} tabIndex={-1}>
                {titles[stage]}
              </h1>
              <p className="small">{descriptions[stage]}</p>
              {error && (
                <div className="message error" role="alert">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}
              {(stage === "request" || stage === "password") && (
                <form
                  className="sign-in-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setError("");
                    if (stage === "password" && password !== confirmPassword) {
                      setError(
                        "Passwords do not match. Enter the same password in both fields.",
                      );
                      return;
                    }
                    setPending(true);
                    try {
                      const response = await fetch(
                        `${recovery ? "/api/password-reset" : "/api/register"}${stage === "request" ? "" : "/verify"}`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(
                            stage === "request"
                              ? recovery
                                ? { studentId, email }
                                : { studentId, email, fullName, department }
                              : { token, password },
                          ),
                        },
                      );
                      const result = await response.json();
                      if (!response.ok)
                        throw new Error(result.error || "Please try again.");
                      if (stage === "request") {
                        setPreview(result.delivery === "preview");
                        setStage("sent");
                      } else {
                        setPassword("");
                        setConfirmPassword("");
                        setToken("");
                        setStage(
                          result.pendingApproval ? "approval" : "complete",
                        );
                      }
                    } catch (failure) {
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : "Unable to connect. Please try again.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {stage === "request" ? (
                    <>
                      {!recovery && (
                        <label htmlFor="register-name">
                          Full name
                          <input
                            id="register-name"
                            name="fullName"
                            autoComplete="name"
                            required
                            minLength={2}
                            maxLength={100}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={pending}
                          />
                        </label>
                      )}
                      <label htmlFor="register-student">
                        School ID
                        <input
                          id="register-student"
                          name="studentId"
                          autoComplete="off"
                          required
                          maxLength={60}
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          disabled={pending}
                        />
                      </label>
                      {!recovery && (
                        <label htmlFor="register-department">
                          Department
                          <select
                            id="register-department"
                            name="department"
                            value={department}
                            onChange={(e) =>
                              setDepartment(e.target.value as Department)
                            }
                            required
                            disabled={pending}
                          >
                            <option value="">Choose department</option>
                            {DEPARTMENTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label htmlFor="register-email">
                        {recovery ? "Registered email" : "Email address"}
                        <input
                          id="register-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@gmail.com"
                          required
                          maxLength={200}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={pending}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label htmlFor="register-password">
                        Password
                        <input
                          id="register-password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={pending}
                          aria-describedby="password-guidance"
                        />
                      </label>
                      <span
                        id="password-guidance"
                        className="small muted registration-guidance"
                      >
                        Use 12–128 characters. A few unrelated words make a
                        memorable password.
                      </span>
                      <label htmlFor="register-confirm">
                        Confirm password
                        <input
                          id="register-confirm"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={pending}
                        />
                      </label>
                    </>
                  )}
                  <button className="button primary" disabled={pending}>
                    {pending
                      ? "Please wait…"
                      : stage === "request"
                        ? recovery
                          ? "Send password reset link"
                          : "Send verification link"
                        : recovery
                          ? "Reset password"
                          : "Verify and continue"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
              {stage === "sent" && (
                <div className="registration-next" role="status">
                  {preview && (
                    <p className="small">
                      Ask your administrator for the local verification link.
                    </p>
                  )}
                  <p className="small">
                    {preview
                      ? "No preview? Confirm your school details with the registrar."
                      : recovery
                        ? "No email? Check spam or confirm your registered email with the registrar."
                        : "No email? Check spam or confirm your school details with the registrar."}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setStage("request");
                      setError("");
                    }}
                  >
                    Request another link
                  </button>
                </div>
              )}
              {stage === "complete" && (
                <Link
                  className="button primary registration-finish"
                  href="/login"
                >
                  Sign in <ArrowRight size={16} />
                </Link>
              )}
              {stage === "password" && (
                <button
                  className="text-link registration-restart"
                  onClick={() => {
                    setStage("request");
                    setToken("");
                    setPassword("");
                    setConfirmPassword("");
                    setError("");
                  }}
                >
                  Link expired? Request a new one
                </button>
              )}
              {stage !== "complete" && (
                <p className="small sign-in-help">
                  <Link className="text-link registration-back" href="/login">
                    <ArrowLeft size={14} /> Back to sign in
                  </Link>
                </p>
              )}
              {stage === "request" && (
                <p className="small sign-in-help muted">
                  Staff access: contact your administrator.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
