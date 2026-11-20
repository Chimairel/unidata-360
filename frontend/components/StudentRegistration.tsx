"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  LogOut,
} from "lucide-react";
import { AccountAccess } from "./AccountAccess";
import { NeuralSubmit } from "./ui/neural-access-login";
import { evaluatePassword } from "@/shared/password";
import "./AuthControls.css";

type Stage = "request" | "sent" | "password" | "complete";
export function StudentRegistration({
  purpose = "registration",
}: { purpose?: "registration" | "recovery" } = {}) {
  const router = useRouter();
  const recovery = purpose === "recovery";
  const [stage, setStage] = useState<Stage>("request");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [signedInUser, setSignedInUser] = useState<{
    displayName?: string;
    role?: string;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!active) return;
        if (s?.onboardingRequired) {
          router.replace("/onboarding");
          return;
        }
        if (s?.authenticated) setSignedInUser(s.identity || {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [router]);

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

  const handleSignOut = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign-out failed. Try again.");
      setSignedInUser(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-out failed.");
    } finally {
      setPending(false);
    }
  };

  const passwordStrength = evaluatePassword(password);
  const blockedBySession = !!signedInUser && stage === "request";

  const titles = {
    request: blockedBySession
      ? "You’re already signed in"
      : recovery
        ? "Reset your student password"
        : "Activate your student account",
    sent: preview ? "Local email preview saved" : "Check your email",
    password: recovery ? "Choose a new password" : "Choose your password",
    complete: recovery ? "Your password is updated" : "Your account is ready",
  };
  const descriptions = {
    request: blockedBySession
      ? `You’re currently signed in${signedInUser.displayName ? ` as ${signedInUser.displayName}` : ""}. Sign out first if you want to ${recovery ? "reset another student’s password" : "activate another student account"}.`
      : recovery
        ? "Enter your School ID (e.g., 20221010) and the email registered to your student account."
        : "First-time students now activate right at sign-in using their School ID and default password (123456). You can also request an activation link below if needed.",
    sent: preview
      ? `A local ${recovery ? "password reset" : "activation"} preview for ${email} was saved on the server. Links expire in 30 minutes.`
      : recovery
        ? `A password reset link was sent to ${email}. Open it within 30 minutes to choose a new password.`
        : `An activation link was sent to ${email}. Open it within 30 minutes to set your first password.`,
    password: recovery
      ? "Choose a strong new password. This will sign out all existing account sessions."
      : "Set a strong password you’ll use to sign in with your school ID.",
    complete: recovery
      ? "Sign in with your school ID and new password. Previous sessions have been signed out."
      : "Sign in with your school ID and password.",
  };
  return (
    <AccountAccess current={recovery ? "recovery" : "register"}>
      <h1 ref={heading} tabIndex={-1}>
        {titles[stage]}
      </h1>
      <p className="account-description">{descriptions[stage]}</p>
      {error && (
        <div className="message error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {blockedBySession ? (
        <div className="sign-in-existing">
          <div className="sign-in-existing-actions">
            <Link className="button primary" href="/">
              Open workspace <ArrowRight size={16} />
            </Link>
            <button
              type="button"
              className="button secondary"
              disabled={pending}
              onClick={() => void handleSignOut()}
            >
              <LogOut size={15} />
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      ) : (
        (stage === "request" || stage === "password") && (
          <form
            className="sign-in-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              if (stage === "password") {
                if (!passwordStrength.valid) {
                  setError(
                    passwordStrength.message || "Choose a stronger password.",
                  );
                  return;
                }
                if (password !== confirmPassword) {
                  setError(
                    "Passwords do not match. Enter the same password in both fields.",
                  );
                  return;
                }
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
                  School ID
                  <input
                    id="register-student"
                    name="studentId"
                    autoComplete="off"
                    placeholder="20221010"
                    required
                    maxLength={60}
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    disabled={pending}
                  />
                </label>
                <label htmlFor="register-email">
                  {recovery ? "Registered email" : "Enrollment email"}
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
                  <div className="password-input-wrap">
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={pending}
                      aria-describedby="password-guidance"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={pending}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <ul
                  id="password-guidance"
                  className="password-checklist"
                  aria-live="polite"
                >
                  <li className={passwordStrength.lengthOk ? "is-met" : ""}>
                    {passwordStrength.lengthOk ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Circle size={13} />
                    )}
                    12–128 characters
                  </li>
                  <li className={passwordStrength.complexityOk ? "is-met" : ""}>
                    {passwordStrength.complexityOk ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Circle size={13} />
                    )}
                    3 of 4 types (uppercase, lowercase, number, symbol) or 16+
                    char passphrase
                  </li>
                </ul>
                <label htmlFor="register-confirm">
                  Confirm password
                  <input
                    id="register-confirm"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
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
            <NeuralSubmit>
              <button className="button primary" disabled={pending}>
                {pending
                  ? "Please wait…"
                  : stage === "request"
                    ? recovery
                      ? "Send password reset link"
                      : "Send activation link"
                    : recovery
                      ? "Reset password"
                      : "Activate account"}
                <ArrowRight size={16} />
              </button>
            </NeuralSubmit>
          </form>
        )
      )}
      {stage === "sent" && (
        <div className="registration-next" role="status">
          {preview && (
            <p className="small">
              Ask your administrator for the local verification link saved in
              backend/.local-email/.
            </p>
          )}
          <p className="small">
            {preview
              ? "Need to try a different address? Wait 60 seconds or ask the Registrar."
              : "Don’t see it? Check your spam folder before requesting another link."}
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
        <Link className="button primary registration-finish" href="/login">
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
      {stage === "request" && !blockedBySession && (
        <p className="small sign-in-help muted">
          Missing or outdated email? Contact the Registrar.
        </p>
      )}
    </AccountAccess>
  );
}
