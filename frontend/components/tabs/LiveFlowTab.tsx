"use client";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  Globe,
  Lock,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { formatPHP, ROLE_LABELS, WEBSITE_ORDER_DEMO } from "@/shared/retail";
import { formatTime } from "@/frontend/components/ui";
import type { TabId } from "@/frontend/lib/workspaceAccess";
import type { Feed } from "@/shared/types";

type ScenarioKey = "intro" | "pos" | "online" | "spike" | "restock" | "reset";

export function LiveFlowTab({
  onNavigate,
}: {
  onNavigate: (tab: TabId) => void;
}) {
  const {
    currentRole,
    branchScope,
    sourceCounts,
    stockItems,
    customers,
    cdcEvents,
    salesSummary,
    auditIntegrity,
    isSyncing,
    recordPOSSale,
    simulateWebsiteOrder,
    simulateSeasonalSpike,
    restockSKU,
    resetAllData,
  } = useEDM();

  const [scenario, setScenario] = useState<ScenarioKey>("intro");

  const isOps = currentRole === "OPS_MANAGER";
  const canPOS =
    currentRole === "OPS_MANAGER" || currentRole === "BRANCH_MANAGER";

  const syncedCount = stockItems.filter(
    (s) => s.stockStatus === "Synced",
  ).length;
  const alertCount = stockItems.length - syncedCount;
  const oversoldItem = stockItems.find((s) => s.stockStatus === "Oversell Risk");
  const sku101 = stockItems.find((s) => s.sku === "SKU-101");
  const websiteDemoProduct = stockItems.find(
    (s) => s.sku === WEBSITE_ORDER_DEMO.sku,
  );
  const sku103 = stockItems.find((s) => s.sku === "SKU-103");

  const activeOffers = customers.filter(
    (c) => c.personalizedOffer.status === "Active",
  ).length;
  const blockedOffers = customers.length - activeOffers;

  const sampleOptIn =
    customers.find((c) => c.gdprConsent === "Opted In") || customers[0];

  const touchedFeeds: Record<ScenarioKey, Feed[]> = {
    intro: ["POS", "INVENTORY", "CRM", "ONLINE", "LOGISTICS"],
    pos: ["POS", "INVENTORY", "CRM"],
    online: ["ONLINE", "INVENTORY", "CRM", "LOGISTICS"],
    spike: ["POS", "INVENTORY", "ONLINE", "LOGISTICS"],
    restock: ["INVENTORY"],
    reset: ["POS", "INVENTORY", "CRM", "ONLINE", "LOGISTICS"],
  };

  const activeFeedSet = new Set(touchedFeeds[scenario]);

  const calloutCopy: Record<ScenarioKey, string> = {
    intro:
      "All 5 retail systems are connected and syncing live across Manila POS, Cebu POS, Online Storefront, and 3PL couriers.",
    pos: `Manila POS sold 1 ${sku101?.productName || "Apple Airpods"} (${formatPHP(sku101?.unitPrice ?? 7280)}) via Real-Time API, deducted Manila stock via CDC, tokenized Clara's card (•••• 4242), and updated Unified Sales.`,
    online: `The website order simulation sold ${websiteDemoProduct?.productName || "Chanel Coco Noir Eau De"}, deducted online warehouse stock, and created a sample ${WEBSITE_ORDER_DEMO.carrier} shipment.`,
    spike: `11.11 Flash Sale fired 6 concurrent orders across POS and Online, pushing ${sku103?.productName || "Eyeshadow Palette with Mirror"} negative (-3) and flagging J&T Express congestion in CDC.`,
    restock:
      "Restocked +20 units (+6 Manila, +6 Cebu, +8 Online Warehouse), clearing channel Oversell Risk back to Synced in one transactional commit.",
    reset:
      "Restored all 5 baseline PostgreSQL feeds (POS, Inventory, CRM, Online, 3PL Logistics) while retaining the SHA-256 audit chain.",
  };

  const sources = [
    {
      feed: "POS" as Feed,
      name: "In-Store POS",
      desc: "Manila & Cebu cashiers",
      count: sourceCounts.POS,
      icon: ShoppingBag,
    },
    {
      feed: "INVENTORY" as Feed,
      name: "Inventory",
      desc: "Branch, online & DummyJSON API",
      count: sourceCounts.INVENTORY,
      icon: Package,
    },
    {
      feed: "CRM" as Feed,
      name: "Customer CRM",
      desc: "Loyalty & GDPR consent",
      count: sourceCounts.CRM,
      icon: Users,
    },
    {
      feed: "ONLINE" as Feed,
      name: "Online Store",
      desc: "Public website checkout",
      count: sourceCounts.ONLINE,
      icon: Globe,
    },
    {
      feed: "LOGISTICS" as Feed,
      name: "3PL Delivery",
      desc: "LBC, J&T, Grab & DHL",
      count: sourceCounts.LOGISTICS,
      icon: Truck,
    },
  ];

  return (
    <div className="page-stack">
      <div className="hero-header">
        <div>
          <h1>Store Operations Overview</h1>
          <p>
            Real-time POS checkouts, inventory sync, customer profiles, and 3PL
            deliveries across Manila, Cebu, and Online.
          </p>
        </div>

        <div className="scenario-strip" role="group" aria-label="Store scenarios">
          <button
            type="button"
            className={`button ${scenario === "pos" ? "primary" : "secondary"}`}
            disabled={!canPOS || isSyncing}
            title={`Clara buys 1 ${sku101?.productName || "Apple Airpods"} at Manila Store (Card, ${formatPHP(sku101?.unitPrice ?? 7280)})`}
            onClick={async () => {
              const ok = await recordPOSSale({
                branch: "Manila",
                sku: "SKU-101",
                customerId: "CUST-001",
                quantity: 1,
                paymentMethod: "Card",
              });
              if (ok) setScenario("pos");
            }}
          >
            <ShoppingBag size={15} />
            In-Store Sale (POS)
          </button>

          <button
            type="button"
            className={`button ${scenario === "online" ? "primary" : "secondary"}`}
            disabled={!isOps || isSyncing}
            title="Simulate a customer checkout and courier shipment from the public website"
            onClick={async () => {
              const ok = await simulateWebsiteOrder();
              if (ok) setScenario("online");
            }}
          >
            <Globe size={15} />
            Simulate Online Order + 3PL
          </button>

          <button
            type="button"
            className={`button ${scenario === "spike" ? "primary" : "danger-button"}`}
            disabled={!isOps || isSyncing}
            title="6 burst orders across Manila, Cebu & Online trigger oversell & 3PL congestion"
            onClick={async () => {
              const ok = await simulateSeasonalSpike();
              if (ok) setScenario("spike");
            }}
          >
            <Zap size={15} />
            11.11 Flash Spike
          </button>

          {isOps && (
            <button
              type="button"
              className="button quiet"
              disabled={isSyncing}
              onClick={async () => {
                if (await resetAllData()) setScenario("reset");
              }}
            >
              <RotateCcw size={14} />
              Reset Data
            </button>
          )}
        </div>
      </div>

      <div className="event-strip" role="status" aria-live="polite">
        <Activity size={16} className="event-strip-icon" />
        <p className="event-strip-copy">{calloutCopy[scenario]}</p>
        {oversoldItem && canPOS && (
          <button
            type="button"
            className="button primary"
            disabled={isSyncing}
            onClick={async () => {
              if (await restockSKU(oversoldItem.sku, 20))
                setScenario("restock");
            }}
          >
            <RefreshCw size={14} />
            Fix Oversold Stock (+20 {oversoldItem.sku})
          </button>
        )}
      </div>

      <section
        className="pipeline-canvas"
        aria-label="Live data flow from sources to outputs"
      >
        {/* Column 1: Sources */}
        <div className="pipeline-col">
          <div className="pipeline-col-head">
            <h2>1. Sources</h2>
            <span>5 live feeds</span>
          </div>
          <div className="pipeline-list">
            {sources.map((s) => {
              const active = activeFeedSet.has(s.feed);
              return (
                <div key={s.feed} className="pipeline-row">
                  <div className="pipeline-row-top">
                    <span
                      className={`pipeline-dot${active ? " is-active" : ""}`}
                      aria-hidden="true"
                    />
                    <s.icon size={14} />
                    <strong>{s.name}</strong>
                    <span className="pipeline-count">{s.count}</span>
                  </div>
                  <small>{s.desc}</small>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2: Integration */}
        <div className="pipeline-col">
          <div className="pipeline-col-head">
            <h2>2. Integration</h2>
            <span>APIs · CDC · Virtual</span>
          </div>
          <div className="pipeline-list">
            <div className="pipeline-method-tags">
              <span className="badge info">Real-Time APIs</span>
              <span className="badge info">CDC Stream</span>
              <span className="badge info">Virtualization</span>
            </div>
            {cdcEvents.slice(0, 3).map((ev) => (
              <div key={ev.id} className="pipeline-row">
                <div className="pipeline-row-top">
                  <strong>{ev.integrationMethod}</strong>
                  <span className="pipeline-count">{ev.latencyMs}ms</span>
                </div>
                <small>{ev.summary}</small>
                <span className="pipeline-time">{formatTime(ev.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Governance */}
        <div className="pipeline-col">
          <div className="pipeline-col-head">
            <h2>3. Governance</h2>
            <span>{ROLE_LABELS[currentRole]}</span>
          </div>
          <div className="pipeline-list">
            <div className="pipeline-row">
              <div className="pipeline-row-top">
                <CreditCard size={14} />
                <strong>PCI DSS (Cards)</strong>
              </div>
              <small className="mono">
                {sampleOptIn?.maskedCardOnFile || "•••• •••• •••• 4242"}
              </small>
            </div>
            <div className="pipeline-row">
              <div className="pipeline-row-top">
                <Lock size={14} />
                <strong>GDPR (Privacy)</strong>
              </div>
              <small>
                {blockedOffers} opted-out offer(s) blocked automatically
              </small>
            </div>
            <div className="pipeline-row">
              <div className="pipeline-row-top">
                <ShieldCheck size={14} />
                <strong>Scope &amp; Audit</strong>
              </div>
              <small>
                {branchScope ? `${branchScope} POS only` : "All channels"} ·{" "}
                {auditIntegrity ? "SHA-256 verified" : "Audit alert"}
              </small>
            </div>
          </div>
        </div>

        {/* Column 4: Outputs */}
        <div className="pipeline-col is-outputs">
          <div className="pipeline-col-head">
            <h2>4. Outputs</h2>
            <span>Select to inspect</span>
          </div>
          <div className="pipeline-list">
            <button
              type="button"
              className="pipeline-output-row"
              onClick={() => onNavigate("stock")}
            >
              <div className="pipeline-row-top">
                <strong>Real-Time Stock Sync</strong>
                <ArrowUpRight size={14} />
              </div>
              <div className="pipeline-output-metric">
                {syncedCount} Synced ·{" "}
                <span className={alertCount > 0 ? "text-danger" : ""}>
                  {alertCount} Alert(s)
                </span>
              </div>
              <small>Open Stock &amp; Delivery</small>
            </button>

            <button
              type="button"
              className="pipeline-output-row"
              onClick={() => onNavigate("customers")}
            >
              <div className="pipeline-row-top">
                <strong>Personalized Offers</strong>
                <ArrowUpRight size={14} />
              </div>
              <div className="pipeline-output-metric">
                {activeOffers} Active · {blockedOffers} Blocked
              </div>
              <small>Open Customers &amp; Offers</small>
            </button>

            <button
              type="button"
              className="pipeline-output-row"
              onClick={() => onNavigate("sales")}
            >
              <div className="pipeline-row-top">
                <strong>Unified Sales</strong>
                <ArrowUpRight size={14} />
              </div>
              <div className="pipeline-output-metric">
                {formatPHP(salesSummary.totalRevenue)}
              </div>
              <small>{salesSummary.totalOrders} orders · Sales &amp; Privacy</small>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
