"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { AccountAccess } from "./AccountAccess";
import { NeuralSubmit } from "./ui/neural-access-login";
import { evaluatePassword } from "@/shared/password";
import "./AuthControls.css";

interface OnboardingStudent {
  studentId: string;
  displayName: string;
  emailHint: string;
  department?: string;
}

export function StudentOnboarding() {
  const router = useRouter();
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;

  const [student, setStudent] = useState<OnboardingStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (active) router.replace("/login");
          return null;
        }
        return (await response.json()) as { student: OnboardingStudent };
      })
      .then((data) => {
        if (active && data?.student) setStudent(data.student);
      })
      .catch(() => {
        if (active) {
          setError(
            "Unable to reach the activation service. Refresh this page to try again.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const strength = evaluatePassword(
    password,
    student ? [student.studentId, student.displayName, email] : [email],
  );

  const handleCancel = async () => {
    setPending(true);
    setError("");
    try {
      await fetch("/api/onboarding", { method: "DELETE" });
      router.replace("/login");
    } catch {
      setError("Could not cancel activation. Try again.");
      setPending(false);
    }
  };

  return (
    <AccountAccess current="onboarding">
      <h1>Activate account</h1>
      <p className="account-description">
        {loading
          ? "Checking your first-time sign-in…"
          : "Required first-time step: confirm your enrollment email and replace the default password (123456) to enter your student workspace."}
      </p>
      {student && (
        <div className="onboarding-identity" role="status">
          <ShieldCheck size={17} />
          <div>
            <strong>{student.displayName}</strong>
            <span>
              ID {student.studentId}
              {student.department ? ` · ${student.department}` : ""} · Email on
              file: {student.emailHint}
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="message error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {student && (
        <form
          className="sign-in-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            if (password.trim() === "123456") {
              setError(
                "You cannot keep the default password (123456). Choose a new personal password.",
              );
              return;
            }
            if (!strength.valid) {
              setError(strength.message || "Choose a stronger password.");
              return;
            }
            if (password !== confirmPassword) {
              setError(
                "Passwords do not match. Enter the same password in both fields.",
              );
              return;
            }
            setPending(true);
            try {
              const response = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              const result = await response.json();
              if (!response.ok) {
                if (response.status === 401) {
                  router.replace("/login");
                  return;
                }
                throw new Error(
                  result.error || "Activation could not be completed.",
                );
              }
              setPassword("");
              setConfirmPassword("");
              router.replace("/");
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Unable to complete activation. Try again.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <label htmlFor={emailId}>
            Confirm enrollment email
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="your.name@gmail.com"
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </label>
          <label htmlFor={passwordId}>
            New personal password
            <div className="password-input-wrap">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                aria-describedby="onboarding-password-guidance"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={pending}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <ul
            id="onboarding-password-guidance"
            className="password-checklist"
            aria-live="polite"
          >
            <li className={strength.lengthOk ? "is-met" : ""}>
              {strength.lengthOk ? (
                <CheckCircle2 size={13} />
              ) : (
                <Circle size={13} />
              )}
              12–128 characters (cannot be 123456)
            </li>
            <li className={strength.complexityOk ? "is-met" : ""}>
              {strength.complexityOk ? (
                <CheckCircle2 size={13} />
              ) : (
                <Circle size={13} />
              )}
              3 of 4 types (uppercase, lowercase, number, symbol) or 16+ char
              passphrase
            </li>
          </ul>
          <label htmlFor={confirmId}>
            Confirm new password
            <input
              id={confirmId}
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
          <NeuralSubmit>
            <button className="button primary" disabled={pending}>
              {pending ? "Activating…" : "Activate & continue"}
              <ArrowRight size={16} />
            </button>
          </NeuralSubmit>
        </form>
      )}
      <p className="small sign-in-help">
        <button
          type="button"
          className="text-link onboarding-cancel"
          disabled={pending}
          onClick={() => void handleCancel()}
        >
          <LogOut size={14} /> Cancel & return to sign in
        </button>
      </p>
      <p className="small sign-in-help muted">
        Wrong email on file? Contact the Registrar to update your enrollment
        record.
      </p>
    </AccountAccess>
  );
}
