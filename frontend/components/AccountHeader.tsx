import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { BrandMark } from "./BrandMark";

export function AccountHeader({
  current,
}: {
  current: "login" | "register" | "recovery" | "onboarding";
}) {
  return (
    <header className="account-header">
      <div className="account-header-inner">
        <Link
          href="/login"
          className="account-header-brand"
          aria-label="Karto sign in"
        >
          <span className="brand-mark">
            <BrandMark size={22} compact />
          </span>
          <span>
            <strong>Karto</strong>
            <span className="account-header-subtitle">
              Retail &amp; E-Commerce EDM
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
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
