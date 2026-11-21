"use client";
import { useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { EDMProvider, useEDM } from "@/frontend/lib/context/EDMContext";
import { Navbar } from "@/frontend/components/Navbar";
import {
  effectiveWorkspaceTab,
  type TabId,
} from "@/frontend/lib/workspaceAccess";
import { LiveFlowTab } from "@/frontend/components/tabs/LiveFlowTab";
import { CheckoutTab } from "@/frontend/components/tabs/CheckoutTab";
import { StockDeliveryTab } from "@/frontend/components/tabs/StockDeliveryTab";
import { CustomersOffersTab } from "@/frontend/components/tabs/CustomersOffersTab";
import { SalesPrivacyTab } from "@/frontend/components/tabs/SalesPrivacyTab";
import { DataQualityTab } from "@/frontend/components/tabs/DataQualityTab";
import { SystemArchitectureModal } from "@/frontend/components/SystemArchitectureModal";
import { SignIn } from "@/frontend/components/SignIn";
import { MercuryBackdrop } from "@/frontend/components/ui/neural-access-login";

function Workspace() {
  const [selectedTab, setSelectedTab] = useState<TabId>("checkout");
  const [architecture, setArchitecture] = useState(false);
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

  const activeTab = effectiveWorkspaceTab(currentRole, selectedTab);

  return (
    <div className="app-shell">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setSelectedTab}
        openArchitecture={() => setArchitecture(true)}
      />
      <main id="workspace" className="workspace">
        <MercuryBackdrop still />
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
            aria-label="Loading retail workspace"
          >
            <div />
            <div />
            <div />
            <p>Loading your permitted retail workspace…</p>
          </div>
        ) : (
          <>
            {activeTab === "flow" && (
              <LiveFlowTab onNavigate={(tab) => setSelectedTab(tab)} />
            )}
            {activeTab === "checkout" && (
              <CheckoutTab onNavigate={(tab) => setSelectedTab(tab)} />
            )}
            {activeTab === "stock" && <StockDeliveryTab />}
            {activeTab === "customers" && <CustomersOffersTab />}
            {activeTab === "sales" && <SalesPrivacyTab />}
            {activeTab === "quality" && <DataQualityTab />}
          </>
        )}
      </main>
      <footer className="app-footer">
        <span>
          Karto <span className="footer-dot">·</span> Retail &amp; E-Commerce EDM
        </span>
        <span>
          PCI DSS &amp; GDPR Enforced <span className="footer-dot">·</span>{" "}
          {actorName}
        </span>
      </footer>
      {architecture && !isLoading && (
        <SystemArchitectureModal
          isOpen
          onClose={() => setArchitecture(false)}
        />
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
