"use client";
import Link from "next/link";
import {
  Workflow,
  ShoppingCart,
  Package,
  Users,
  ShieldCheck,
  ClipboardCheck,
  Network,
  Store,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { ROLE_LABELS } from "@/shared/retail";
import { workspaceTabs, type TabId } from "@/frontend/lib/workspaceAccess";
import { ThemeToggle } from "./ThemeToggle";
import { BrandMark } from "./BrandMark";

export type { TabId } from "@/frontend/lib/workspaceAccess";

const tabs = [
  { id: "checkout", label: "POS Register", short: "POS", icon: ShoppingCart },
  {
    id: "stock",
    label: "Stock & 3PL",
    short: "Stock",
    icon: Package,
  },
  {
    id: "customers",
    label: "Customers",
    short: "Customers",
    icon: Users,
  },
  {
    id: "sales",
    label: "Sales & Audit",
    short: "Sales",
    icon: ShieldCheck,
  },
  { id: "flow", label: "Data Flow", short: "Flow", icon: Workflow },
  { id: "quality", label: "Data Quality", short: "Quality", icon: ClipboardCheck },
] as const;

function cleanActorName(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Lourdes Bautista";
}

function actorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function Navbar({
  activeTab,
  setActiveTab,
  openArchitecture,
}: {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  openArchitecture: () => void;
}) {
  const {
    currentRole,
    actorName,
    isSyncing,
    isLoading,
    signOut,
  } = useEDM();

  const allowed = workspaceTabs(currentRole);
  const visibleTabs = isLoading
    ? []
    : allowed.map((id) => tabs.find((t) => t.id === id)!);

  const displayName = cleanActorName(actorName);

  const brand = (
    <Link className="brand" href="/" aria-label="Karto home">
      <span className="brand-mark">
        <BrandMark size={22} compact />
      </span>
      <span>
        <strong>Karto</strong>
        <small>Retail &amp; E-Commerce</small>
      </span>
    </Link>
  );

  return (
    <>
      <aside className="workspace-sidebar" aria-label="Retail workspace">
        <Link className="rail-brand" href="/" aria-label="Karto home">
          <BrandMark size={26} />
        </Link>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {visibleTabs.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              className={`sidebar-link ${activeTab === id ? "active" : ""}`}
              aria-label={label}
              aria-current={activeTab === id ? "page" : undefined}
              title={label}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={23} />
              <span>{short}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!isLoading && (
            <Link
              href="/shop"
              className="rail-tool"
              aria-label="Open Online Storefront"
              title="Open Online Storefront (/shop)"
            >
              <Store size={21} />
            </Link>
          )}
          {!isLoading && (
            <button
              className="rail-tool"
              aria-label="Data pipeline map"
              title="Data pipeline map"
              onClick={openArchitecture}
            >
              <Network size={23} />
            </button>
          )}
          {!isLoading && (
            <button
              className="rail-tool"
              aria-label="Sign out"
              title="Sign out"
              disabled={isSyncing}
              onClick={() => void signOut()}
            >
              <LogOut size={22} />
            </button>
          )}
        </div>
      </aside>

      <header className="workspace-header">
        <div className="workspace-header-main">
          <div className="header-brand">{brand}</div>
          <div className="workspace-location">
            <ChevronRight size={13} />
            <strong>
              {visibleTabs.find((t) => t.id === activeTab)?.label}
            </strong>
          </div>

          <div className="workspace-actions">
            <ThemeToggle />
            {!isLoading && (
              <Link
                href="/shop"
                className="icon-button mobile-matrix"
                aria-label="Open Online Storefront"
                title="Open Online Storefront (/shop)"
              >
                <Store size={18} />
              </Link>
            )}
            {!isLoading && (
              <button
                className="icon-button mobile-matrix"
                aria-label="Data pipeline map"
                onClick={openArchitecture}
              >
                <Network size={18} />
              </button>
            )}
            {!isLoading && (
              <button
                className="icon-button mobile-matrix"
                aria-label="Sign out"
                title="Sign out"
                disabled={isSyncing}
                onClick={() => void signOut()}
              >
                <LogOut size={18} />
              </button>
            )}
            {!isLoading && (
              <div className="workspace-user">
                <span className="workspace-user-avatar" aria-hidden="true">
                  {actorInitials(displayName)}
                </span>
                <div className="workspace-user-meta">
                  <strong>{displayName}</strong>
                  <span>{ROLE_LABELS[currentRole]}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav
          className="compact-nav"
          aria-label="Mobile workspace navigation"
          style={{
            gridTemplateColumns: `repeat(${visibleTabs.length || 1}, minmax(0, 1fr))`,
          }}
        >
          {visibleTabs.map(({ id, label, short, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              className={activeTab === id ? "active" : ""}
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={18} />
              <span>{short}</span>
            </button>
          ))}
        </nav>
      </header>
    </>
  );
}
