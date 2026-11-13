"use client";
import { useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { EDMProvider, useEDM } from "@/frontend/lib/context/EDMContext";
import { Navbar } from "@/frontend/components/Navbar";
import {
  defaultWorkspaceTab,
  effectiveWorkspaceTab,
  type TabId,
} from "@/frontend/lib/workspaceAccess";
import { Student360Tab } from "@/frontend/components/tabs/Student360Tab";
import { StudentWorkspace } from "@/frontend/components/StudentWorkspace";
import { IntegrationPipelineTab } from "@/frontend/components/tabs/IntegrationPipelineTab";
import { AcademicAnalyticsTab } from "@/frontend/components/tabs/AcademicAnalyticsTab";
import { GovernanceTab } from "@/frontend/components/tabs/GovernanceTab";
import { SystemArchitectureModal } from "@/frontend/components/SystemArchitectureModal";
import { PresentationMode } from "@/frontend/components/PresentationMode";
import { SignIn } from "@/frontend/components/SignIn";
import type { UserRole } from "@/shared/types";

function Workspace() {
  const [selection, setSelection] = useState<{
    role: UserRole;
    tab: TabId;
  } | null>(null);
  const [architecture, setArchitecture] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const {
    isLoading,
    error,
    notice,
    dismissMessage,
    refresh,
    currentRole,
    actorName,
    requiresSignIn,
  } = useEDM();
  if (requiresSignIn) return <SignIn onSignedIn={() => void refresh()} />;
  const activeTab =
    selection?.role === currentRole
      ? effectiveWorkspaceTab(currentRole, selection.tab)
      : defaultWorkspaceTab(currentRole);
  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => setSelection({ role: currentRole, tab })}
        openArchitecture={() => setArchitecture(true)}
        openPresentation={() => setPresentation(true)}
      />
      <main id="workspace" className="workspace">
        {(error || notice) && (
          <div
            className={`message ${error ? "error" : "success"}`}
            role={error ? "alert" : "status"}
          >
            {error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
            <span>{error || notice}</span>
            {error && (
              <button className="button quiet" onClick={() => void refresh()}>
                Reload data
              </button>
            )}
            <button
              className="icon-button"
              onClick={dismissMessage}
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {isLoading ? (
          <div
            className="loading-state"
            aria-busy="true"
            aria-label="Loading university workspace"
          >
            <div />
            <div />
            <div />
            <p>Loading your permitted workspace…</p>
          </div>
        ) : (
          <>
            {activeTab === "student360" &&
              (currentRole === "STUDENT" ? (
                <StudentWorkspace />
              ) : (
                <Student360Tab key={currentRole} />
              ))}
            {activeTab === "pipeline" && <IntegrationPipelineTab />}
            {activeTab === "analytics" && (
              <AcademicAnalyticsTab key={currentRole} />
            )}
            {activeTab === "governance" && <GovernanceTab />}
          </>
        )}
      </main>
      <footer className="app-footer">
        <span>
          UniData 360 <span className="footer-dot">·</span> EDM course
          demonstration
        </span>
        <span>
          Synthetic data <span className="footer-dot">·</span>{" "}
          {currentRole === "STUDENT"
            ? "Student self-access"
            : actorName.split(" (")[0]}
        </span>
      </footer>
      {architecture && currentRole !== "STUDENT" && !isLoading && (
        <SystemArchitectureModal
          isOpen
          onClose={() => setArchitecture(false)}
        />
      )}
      {presentation && currentRole !== "STUDENT" && !isLoading && (
        <PresentationMode onClose={() => setPresentation(false)} />
      )}
    </div>
  );
}
export default function Dashboard() {
  return (
    <EDMProvider>
      <Workspace />
    </EDMProvider>
  );
}
