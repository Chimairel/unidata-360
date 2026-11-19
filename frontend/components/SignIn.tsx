"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, AlertCircle } from "lucide-react";
import { AccountAccess } from "./AccountAccess";
import { NeuralSubmit } from "./ui/neural-access-login";

export function SignIn({ onSignedIn }: { onSignedIn?: () => void } = {}) {
  const router = useRouter();
  const formId = useId();
  const identifierId = `${formId}-identifier`;
  const passwordId = `${formId}-password`;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [accountsRequired, setAccountsRequired] = useState<boolean | null>(
    null,
  );
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((s) => {
        if (active) {
          setAccountsRequired(s.accountsRequired);
          setSignedIn(s.authenticated);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Unable to check access mode. Refresh this page to try again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <AccountAccess current="login">
      <h1>Sign in</h1>
      {error && (
        <div className="message error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}
      {signedIn ? (
        <div className="sign-in-existing">
          <p>You’re signed in.</p>
          <Link className="button primary" href="/">
            Open workspace <ArrowRight size={16} />
          </Link>
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
                body: JSON.stringify({ identifier, password }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              setPassword("");
              if (onSignedIn) onSignedIn();
              else {
                router.replace("/");
                router.refresh();
              }
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
          <label htmlFor={identifierId}>
            School ID or staff email
            <input
              id={identifierId}
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={200}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="STU-2024-001 or staff@cpc.edu"
              disabled={pending}
            />
          </label>
          <label htmlFor={passwordId}>
            Password
            <input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </label>
          <NeuralSubmit>
            <button className="button primary" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </NeuralSubmit>
        </form>
      )}
      <p className="small sign-in-help">
        <Link className="text-link" href="/register">
          Create student account
        </Link>
      </p>
      <p className="small sign-in-help muted">
        <Link className="text-link" href="/reset-password">
          Forgot student password?
        </Link>
      </p>
      <p className="small sign-in-help muted">
        Staff access: contact your administrator.
      </p>
      {accountsRequired === false && (
        <div className="sign-in-demo">
          <Link className="text-link" href="/">
            Open demo
          </Link>
        </div>
      )}
    </AccountAccess>
  );
}
