import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function AccountHeader({ current }: { current: "login" | "register" }) {
  return (
    <header className="account-header">
      <div className="account-header-inner">
        <Link
          href="/login"
          className="account-header-brand"
          aria-label="UniData 360 sign in"
        >
          <span className="brand-mark">
            <GraduationCap size={23} />
          </span>
          <span>
            <strong>UniData 360</strong>
            <span className="account-header-subtitle">
              University data workspace
            </span>
          </span>
        </Link>
        <nav className="account-header-nav" aria-label="Account navigation">
          <Link
            href="/login"
            aria-current={current === "login" ? "page" : undefined}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            aria-current={current === "register" ? "page" : undefined}
          >
            Student registration
          </Link>
        </nav>
      </div>
    </header>
  );
}
