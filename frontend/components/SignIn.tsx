"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { AccountHeader } from "./AccountHeader";

export function SignIn({ onSignedIn }: { onSignedIn?: () => void } = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
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
    <div className="account-page">
      <AccountHeader current="login" />
      <main className="sign-in-shell">
        <section className="sign-in-content">
          <div className="sign-in-story">
            <h1>
              Your role.
              <br /> Your permitted workspace.
            </h1>
            <p>
              Connect the student lifecycle through trusted records, clear
              insights, and accountable access.
            </p>
            <dl className="sign-in-benefits">
              <div>
                <dt>One connected record</dt>
                <dd>SIS, learning activity, and library clearance.</dd>
              </div>
              <div>
                <dt>Permissions that follow you</dt>
                <dd>
                  Your account determines the records and fields you can access.
                </dd>
              </div>
              <div>
                <dt>An inspectable history</dt>
                <dd>
                  Sign-ins, data changes, and exports leave an audit trail.
                </dd>
              </div>
            </dl>
            <p className="small">
              Education / Universities · Synthetic course dataset
            </p>
          </div>
          <div className="panel sign-in-panel">
            <div className="panel-body">
              <LockKeyhole className="text-accent" size={24} />
              <h2>Sign in to UniData</h2>
              <p className="small">
                Students can register below. Staff use an account provided by
                the project administrator.
              </p>
              {error && (
                <div className="message error" role="alert">
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              )}
              {signedIn ? (
                <div className="sign-in-existing">
                  <p>You already have an active account session.</p>
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
                        body: JSON.stringify({ email, password }),
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
                  <label htmlFor="account-email">
                    Email address
                    <input
                      id="account-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      maxLength={200}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@university.edu"
                      disabled={pending}
                    />
                  </label>
                  <label htmlFor="account-password">
                    Password
                    <input
                      id="account-password"
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
                  <button className="button primary" disabled={pending}>
                    {pending ? "Signing in…" : "Sign in"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
              <p className="small sign-in-help">
                New student?{" "}
                <Link className="text-link" href="/register">
                  Create your student account
                </Link>
              </p>
              <p className="small sign-in-help muted">
                Staff accounts and password resets: contact your project
                administrator.
              </p>
              {accountsRequired === false && (
                <div className="sign-in-demo">
                  <span className="small muted">Presenting in class?</span>
                  <Link className="text-link" href="/">
                    Open the demo workspace
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
        <footer className="sign-in-footer">
          <ShieldCheck size={14} />
          <span>
            Student registration requires a matching university record and email
            verification.
          </span>
        </footer>
      </main>
    </div>
  );
}
