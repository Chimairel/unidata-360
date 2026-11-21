"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle, Eye, EyeOff, LogOut } from "lucide-react";
import { AccountAccess } from "./AccountAccess";
import { NeuralSubmit } from "./ui/neural-access-login";
import "./AuthControls.css";

export function SignIn({ onSignedIn }: { onSignedIn?: () => void } = {}) {
  const router = useRouter();
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [signedInUser, setSignedInUser] = useState<{
    displayName?: string;
    role?: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((s) => {
        if (!active) return;
        setSignedInUser(s.authenticated ? s.identity || {} : null);
      })
      .catch(() => {
        if (active) {
          setError(
            "Unable to reach the authentication service. Refresh this page to try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSignOut = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign-out failed. Try again.");
      setSignedInUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-out failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AccountAccess current="login">
      <h1>Sign in</h1>
      {error && (
        <div className="message error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {signedInUser ? (
        <div className="sign-in-existing">
          <p>
            You’re already signed in
            {signedInUser.displayName ? ` as ${signedInUser.displayName}` : ""}.
          </p>
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
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            try {
              const response = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              setPassword("");
              if (onSignedIn) onSignedIn();
              else router.replace("/");
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Unable to sign in. Try again.",
              );
            } finally {
              setPending(false);
            }
          }}
          className="sign-in-form"
        >
          <label htmlFor={emailId}>
            Work email
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ops@karto.ph"
              disabled={pending}
            />
          </label>
          <label htmlFor={passwordId}>
            Password
            <div className="password-input-wrap">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
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
          <NeuralSubmit>
            <button className="button primary" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </NeuralSubmit>
        </form>
      )}
    </AccountAccess>
  );
}
