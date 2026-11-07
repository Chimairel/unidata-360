"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { AccountHeader } from "./AccountHeader";

type Stage = "request" | "sent" | "password" | "complete";
export function StudentRegistration() {
  const [stage, setStage] = useState<Stage>("request");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
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
      } else
        setError(
          "This verification link is invalid. Request a new link below.",
        );
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
    request: "Create your student account",
    sent: "Check your university email",
    password: "Choose your password",
    complete: "Your account is ready",
  };
  const descriptions = {
    request:
      "Use the student ID and email address recorded in your university’s Student Information System.",
    sent: "If these details match an eligible student record, a verification link is on its way. The link expires in 30 minutes.",
    password:
      "Complete email verification by setting a password for your student account.",
    complete:
      "Your email is verified. Sign in to view your own student record and academic progress.",
  };
  return (
    <div className="account-page">
      <AccountHeader current="register" />
      <main className="sign-in-shell">
        <section className="sign-in-content">
          <div className="sign-in-story">
            <h1>
              Your student record.
              <br /> Your own access.
            </h1>
            <p>
              Set up your account using the university record that already
              belongs to you.
            </p>
            <dl className="sign-in-benefits">
              <div>
                <dt>Match your university record</dt>
                <dd>Enter the student ID and email held by the registrar.</dd>
              </div>
              <div>
                <dt>Verify your email</dt>
                <dd>
                  Open your personal verification link, then choose a password.
                </dd>
              </div>
              <div>
                <dt>Sign in as a student</dt>
                <dd>
                  See your academic profile, engagement, and library clearance.
                </dd>
              </div>
            </dl>
            <p className="small">
              Staff member? Your project administrator creates staff accounts.
            </p>
          </div>
          <div className="panel sign-in-panel">
            <div className="panel-body">
              {stage === "complete" ? (
                <CheckCircle2 size={24} />
              ) : (
                <Mail size={24} />
              )}
              <h2 ref={heading} tabIndex={-1}>
                {titles[stage]}
              </h2>
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
                        stage === "request"
                          ? "/api/register"
                          : "/api/register/verify",
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(
                            stage === "request"
                              ? { studentId, email }
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
                        setStage("complete");
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
                      <label htmlFor="register-student">
                        Student ID
                        <input
                          id="register-student"
                          name="studentId"
                          autoComplete="off"
                          placeholder="STU-2024-004"
                          required
                          maxLength={60}
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          disabled={pending}
                        />
                      </label>
                      <label htmlFor="register-email">
                        University email
                        <input
                          id="register-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@university.edu"
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
                        ? "Send verification link"
                        : "Verify and create account"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
              {stage === "sent" && (
                <div className="registration-next" role="status">
                  {preview && (
                    <p className="small">
                      Local email preview is enabled. Ask the presenter to open
                      the verification message saved on this computer.
                    </p>
                  )}
                  <p className="small">
                    Already registered? Sign in instead. If no message arrives,
                    check spam or ask the registrar to confirm your university
                    details.
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
                  Sign in to your account <ArrowRight size={16} />
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
            </div>
          </div>
        </section>
        <footer className="sign-in-footer">
          <ShieldCheck size={14} />
          <span>
            Self-registration creates Student accounts only. Your access is
            limited to your own record.
          </span>
        </footer>
      </main>
    </div>
  );
}
