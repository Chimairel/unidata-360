"use client";
import Link from "next/link";
import {
  GraduationCap,
  Database,
  Users,
  ChartNoAxesCombined,
  ShieldCheck,
  Presentation,
  Network,
  RefreshCw,
  LogIn,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import type { UserRole } from "@/shared/types";
import { workspaceTabs, type TabId } from "@/frontend/lib/workspaceAccess";
export type { TabId } from "@/frontend/lib/workspaceAccess";
const tabs = [
  { id: "student360", label: "Student 360", short: "Students", icon: Users },
  {
    id: "pipeline",
    label: "Integration pipeline",
    short: "Pipeline",
    icon: Database,
  },
  {
    id: "analytics",
    label: "Academic analytics",
    short: "Analytics",
    icon: ChartNoAxesCombined,
  },
  {
    id: "governance",
    label: "Governance & audit",
    short: "Governance",
    icon: ShieldCheck,
  },
] as const;
export function Navbar({
  activeTab,
  setActiveTab,
  openArchitecture,
  openPresentation,
}: {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  openArchitecture: () => void;
  openPresentation: () => void;
}) {
  const {
    currentRole,
    setCurrentRole,
    actorName,
    executeETL,
    isSyncing,
    isLoading,
    accessMode,
    signOut,
  } = useEDM();
  const allowed = workspaceTabs(currentRole);
  const visibleTabs = isLoading
    ? []
    : allowed.map((id) => {
        const tab = tabs.find((t) => t.id === id)!;
        if (id === "student360" && currentRole === "STUDENT")
          return { ...tab, label: "My student record", short: "My record" };
        if (id === "student360" && currentRole === "COMPLIANCE_AUDITOR")
          return {
            ...tab,
            label: "Masked student summaries",
            short: "Summaries",
          };
        if (id === "governance" && currentRole === "ACADEMIC_ADVISOR")
          return {
            ...tab,
            label: "My activity & access",
            short: "My activity",
          };
        return tab;
      });
  const staff = currentRole !== "STUDENT" && !isLoading;
  const brand = (
    <Link className="brand" href="/" aria-label="UniData home">
      <span className="brand-mark">
        <GraduationCap size={24} />
      </span>
      <span>
        <strong>
          UniData<span className="brand-360">360</span>
        </strong>
        <small>University workspace</small>
      </span>
    </Link>
  );
  return (
    <>
      <aside className="workspace-sidebar" aria-label="University workspace">
        <Link className="rail-brand" href="/" aria-label="UniData home">
          U<span>.</span>
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
          {staff && (
            <button
              className="rail-tool"
              aria-label="Course matrix"
              title="Course matrix"
              onClick={openArchitecture}
            >
              <Network size={23} />
            </button>
          )}
          {accessMode === "account" ? (
            <button
              className="rail-tool"
              aria-label="Sign out"
              title="Sign out"
              disabled={isSyncing}
              onClick={() => void signOut()}
            >
              <LogOut size={22} />
            </button>
          ) : (
            <Link
              className="rail-tool"
              href="/login"
              aria-label="Sign in"
              title="Sign in"
            >
              <LogIn size={22} />
            </Link>
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
            {staff && (
              <button
                className="button secondary present-action"
                aria-label="Present"
                onClick={openPresentation}
              >
                <Presentation size={16} />
                <span>Present</span>
              </button>
            )}
            {currentRole === "DEAN_REGISTRAR" && !isLoading && (
              <button
                className="button primary run-action"
                aria-label={isSyncing ? "Saving changes" : "Run ETL"}
                disabled={
                  isSyncing || isLoading || currentRole !== "DEAN_REGISTRAR"
                }
                title={
                  currentRole !== "DEAN_REGISTRAR"
                    ? "Registrar access is required to run ETL"
                    : undefined
                }
                onClick={() => void executeETL()}
              >
                <RefreshCw size={15} className={isSyncing ? "spin" : ""} />
                <span>{isSyncing ? "Saving…" : "Run ETL"}</span>
              </button>
            )}
            {staff && (
              <button
                className="icon-button mobile-matrix"
                aria-label="Course matrix"
                onClick={openArchitecture}
              >
                <Network size={18} />
              </button>
            )}
          </div>
          <div className="header-identity">
            <span className="user-initials" aria-hidden="true">
              {actorName
                .split(" ")
                .filter((n) => !n.includes("."))
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </span>
            <label className="role-picker">
              <span>
                {accessMode === "account" ? "Account role" : "Demo persona"}
              </span>
              <select
                aria-label={
                  accessMode === "account" ? "Account role" : "Demo persona"
                }
                value={currentRole}
                disabled={isSyncing || isLoading || accessMode === "account"}
                onChange={(e) =>
                  void setCurrentRole(e.target.value as UserRole)
                }
                title={actorName}
              >
                <option value="DEAN_REGISTRAR">Dean / Registrar</option>
                <option value="ACADEMIC_ADVISOR">Academic Advisor</option>
                <option value="STUDENT">
                  {accessMode === "account" ? "Student" : "Student · Marcus"}
                </option>
                <option value="COMPLIANCE_AUDITOR">Compliance Auditor</option>
              </select>
            </label>
            {accessMode === "account" ? (
              <button
                className="icon-button mobile-account"
                aria-label="Sign out"
                disabled={isSyncing}
                onClick={() => void signOut()}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <Link
                className="icon-button mobile-account"
                href="/login"
                aria-label="Sign in"
              >
                <LogIn size={18} />
              </Link>
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
