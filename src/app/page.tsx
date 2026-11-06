"use client";
import { useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { EDMProvider, useEDM } from "@/lib/context/EDMContext";
import { Navbar, type TabId } from "@/components/Navbar";
import { Student360Tab } from "@/components/tabs/Student360Tab";
import { IntegrationPipelineTab } from "@/components/tabs/IntegrationPipelineTab";
import { AcademicAnalyticsTab } from "@/components/tabs/AcademicAnalyticsTab";
import { GovernanceTab } from "@/components/tabs/GovernanceTab";
import { SystemArchitectureModal } from "@/components/SystemArchitectureModal";
import { PresentationMode } from "@/components/PresentationMode";
import { SignIn } from "@/components/SignIn";

function Workspace() {
  const [tab, setTab] = useState<TabId>("student360");
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
  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <Navbar
        activeTab={tab}
        setActiveTab={setTab}
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
            {tab === "student360" && <Student360Tab />}
            {tab === "pipeline" && <IntegrationPipelineTab />}
            {tab === "analytics" && <AcademicAnalyticsTab />}
            {tab === "governance" && <GovernanceTab />}
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
      {architecture && (
        <SystemArchitectureModal
          isOpen
          onClose={() => setArchitecture(false)}
        />
      )}
      {presentation && (
        <PresentationMode onClose={() => setPresentation(false)} />
      )}
    </div>
  );
}
export default function Home() {
  return (
    <EDMProvider>
      <Workspace />
    </EDMProvider>
  );
}
