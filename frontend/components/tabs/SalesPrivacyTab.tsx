"use client";
import { useState, type DragEvent } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { formatPHP, ROLE_LABELS } from "@/shared/retail";
import type { Feed } from "@/shared/types";
import {
  Badge,
  EmptyState,
  PageHeading,
  ProductImage,
  ReportLink,
  formatTime,
} from "@/frontend/components/ui";

const roleCompare: Array<{
  role: string;
  label: string;
  scope: string;
  pci: string;
  gdpr: string;
}> = [
  {
    role: "OPS_MANAGER",
    label: "Store Operations",
    scope: "All channels",
    pci: "Last 4 (•••• 4242)",
    gdpr: "Full + Consent toggle",
  },
  {
    role: "CASHIER",
    label: "Cashier",
    scope: "Assigned branch register",
    pci: "Last 4 on receipt",
    gdpr: "Walk-in sales only",
  },
  {
    role: "INVENTORY_STAFF",
    label: "Inventory Staff",
    scope: "Stock counts, restocks, and transfers",
    pci: "No card records",
    gdpr: "No customer profiles",
  },
  {
    role: "DELIVERY_COORDINATOR",
    label: "Delivery Coordinator",
    scope: "Dispatch and shipment status",
    pci: "No card records",
    gdpr: "Customer reference only",
  },
  {
    role: "MARKETING_CRM",
    label: "Marketing",
    scope: "All profiles",
    pci: "[PCI DSS Restricted]",
    gdpr: "Opted-Out hidden",
  },
  {
    role: "BRANCH_MANAGER",
    label: "Manila Branch",
    scope: "Manila POS only",
    pci: "Last 4 (Manila POS)",
    gdpr: "[GDPR Masked] PII",
  },
  {
    role: "COMPLIANCE_AUDITOR",
    label: "Auditor",
    scope: "Customer #01..#06",
    pci: "[PCI DSS Masked]",
    gdpr: "[GDPR Masked] PII",
  },
];

const actionText: Record<string, string> = {
  READ_CUSTOMER_360: "Viewed customer receipts",
  INTEGRATION_SYNC: "Synced all 5 data feeds",
  IMPORT_FEED: "Imported CSV/JSON batch",
  CATALOG_IMPORT: "Imported product from DummyJSON API",
  POS_SALE: "Recorded in-store POS sale",
  ONLINE_ORDER: "Placed online order + 3PL",
  CHECKOUT: "Completed omnichannel checkout",
  CUSTOMER_CREATED: "Registered new CRM customer",
  SHIPMENT_UPDATED: "Updated 3PL shipment status",
  STOCK_TRANSFER: "Transferred stock across channels",
  SEASONAL_SPIKE: "Simulated 11.11 flash-sale spike",
  INVENTORY_RESTOCK: "Restocked inventory (+20 units)",
  GDPR_CONSENT_UPDATED: "Updated GDPR privacy consent",
  EXPORT_REPORT: "Exported compliance report",
  SIGN_IN: "Signed in",
  SIGN_OUT: "Signed out",
  LOGIN_FAILED: "Blocked invalid sign-in",
  ACCESS_DENIED: "Blocked unauthorized command",
  ROLE_SWITCH: "Switched demo role",
  RESET_DEMO: "Restored baseline demo data",
};

const feedTemplates: Record<Feed, { csv: string; json: object[] }> = {
  POS: {
    csv: "txId,branch,customerId,sku,productName,quantity,unitPrice,totalAmount,paymentMethod,cardNumber,timestamp\nPOS-9901,Manila,CUST-001,SKU-102,Chanel Coco Noir Eau De,1,7280,7280,Card,4532-8910-4421-4242,2026-11-20T09:00:00.000Z",
    json: [
      {
        txId: "POS-9901",
        branch: "Manila",
        customerId: "CUST-001",
        sku: "SKU-102",
        productName: "Chanel Coco Noir Eau De",
        quantity: 1,
        unitPrice: 7280,
        totalAmount: 7280,
        paymentMethod: "Card",
        cardNumber: "4532-8910-4421-4242",
        timestamp: "2026-11-20T09:00:00.000Z",
      },
    ],
  },
  INVENTORY: {
    csv: "sku,productName,category,unitPrice,manilaStock,cebuStock,warehouseStock,reorderPoint,lastUpdated\nSKU-103,Eyeshadow Palette with Mirror,Beauty & Fragrance,1120,20,15,25,15,2026-11-20T09:00:00.000Z",
    json: [
      {
        sku: "SKU-103",
        productName: "Eyeshadow Palette with Mirror",
        category: "Beauty & Fragrance",
        unitPrice: 1120,
        manilaStock: 20,
        cebuStock: 15,
        warehouseStock: 25,
        reorderPoint: 15,
        lastUpdated: "2026-11-20T09:00:00.000Z",
      },
    ],
  },
  CRM: {
    csv: "customerId,fullName,email,phone,loyaltyTier,pointsBalance,preferredBranch,gdprConsent,favoriteCategory,joinedAt\nCUST-007,Elena Bautista,elena.bautista@gmail.com,+63 917 555 0401,Gold,2100,Manila,Opted In,Electronics,2025-10-01",
    json: [
      {
        customerId: "CUST-007",
        fullName: "Elena Bautista",
        email: "elena.bautista@gmail.com",
        phone: "+63 917 555 0401",
        loyaltyTier: "Gold",
        pointsBalance: 2100,
        preferredBranch: "Manila",
        gdprConsent: "Opted In",
        favoriteCategory: "Electronics",
        joinedAt: "2025-10-01",
      },
    ],
  },
  ONLINE: {
    csv: "orderId,customerId,sku,productName,quantity,totalAmount,paymentMethod,cardNumber,promoCode,orderStatus,orderedAt\nORD-9901,CUST-002,SKU-104,Amazon Echo Plus,1,5600,Card,5412-7512-3456-9811,TECH10,Processing,2026-11-20T09:05:00.000Z",
    json: [
      {
        orderId: "ORD-9901",
        customerId: "CUST-002",
        sku: "SKU-104",
        productName: "Amazon Echo Plus",
        quantity: 1,
        totalAmount: 5600,
        paymentMethod: "Card",
        cardNumber: "5412-7512-3456-9811",
        promoCode: "TECH10",
        orderStatus: "Processing",
        orderedAt: "2026-11-20T09:05:00.000Z",
      },
    ],
  },
  LOGISTICS: {
    csv: "shipmentId,orderId,customerId,carrier,trackingNumber,status,estimatedDelivery,delayReason,updatedAt\nSHP-9901,ORD-5006,CUST-006,LBC Express,LBC-990122,In Transit,2026-11-22,,2026-11-20T09:10:00.000Z",
    json: [
      {
        shipmentId: "SHP-9901",
        orderId: "ORD-5006",
        customerId: "CUST-006",
        carrier: "LBC Express",
        trackingNumber: "LBC-990122",
        status: "In Transit",
        estimatedDelivery: "2026-11-22",
        updatedAt: "2026-11-20T09:10:00.000Z",
      },
    ],
  },
};

function downloadTemplate(feed: Feed, format: "csv" | "json") {
  const tpl = feedTemplates[feed];
  const body = format === "csv" ? tpl.csv : JSON.stringify(tpl.json, null, 2);
  const blob = new Blob([body], {
    type: format === "csv" ? "text/csv" : "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `karto-${feed.toLowerCase()}-template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SalesPrivacyTab() {
  const {
    currentRole,
    branchScope,
    salesSummary,
    customers,
    auditLogs,
    auditIntegrity,
    cdcEvents,
    sourceCounts,
    posRecords,
    inventoryRecords,
    crmRecords,
    onlineRecords,
    logisticsRecords,
    isSyncing,
    importFile,
  } = useEDM();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inspectFeed, setInspectFeed] = useState<Feed>("POS");
  const [uploadFeed, setUploadFeed] = useState<Feed>("POS");
  const [dragging, setDragging] = useState(false);

  const isOps = currentRole === "OPS_MANAGER";
  const canDownloadSales = currentRole !== "COMPLIANCE_AUDITOR";

  const maxCategoryRev = Math.max(
    1,
    ...salesSummary.revenueByCategory.map((c) => c.revenue),
  );

  const sampleOptIn =
    customers.find((c) => c.gdprConsent === "Opted In") || customers[0];
  const sampleOptOut = customers.find((c) => c.gdprConsent === "Opted Out");

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!isOps) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void importFile(uploadFeed, file);
  };

  return (
    <div className="page-stack">
      <PageHeading
        title="Sales & Privacy"
        description={
          branchScope
            ? `Sales scoped to ${branchScope} Store only, paired with PCI DSS & GDPR rules and the SHA-256 audit log.`
            : "Unified Peso revenue across Manila, Cebu, and Online, paired with PCI DSS, GDPR & SHA-256 audit verification."
        }
        action={
          <>
            {canDownloadSales && (
              <ReportLink kind="sales" label="Download Sales PDF" />
            )}
            <ReportLink kind="audit" label="Export Audit CSV" />
          </>
        }
      />

      <dl className="metric-strip cols-3">
        <div className="metric-cell">
          <dt>Manila Store (POS)</dt>
          <dd>
            {formatPHP(salesSummary.posManilaRevenue)}
            <span>
              {posRecords.filter((p) => p.branch === "Manila").length} checkout(s)
            </span>
          </dd>
        </div>

        <div className="metric-cell">
          <dt>Cebu Store (POS)</dt>
          <dd>
            {branchScope ? "Hidden" : formatPHP(salesSummary.posCebuRevenue)}
            <span>
              {branchScope
                ? "Manila scope only"
                : `${posRecords.filter((p) => p.branch === "Cebu").length} checkout(s)`}
            </span>
          </dd>
        </div>

        <div className="metric-cell">
          <dt>Online Storefront</dt>
          <dd>
            {branchScope ? "Hidden" : formatPHP(salesSummary.onlineRevenue)}
            <span>
              {branchScope
                ? "Manila scope only"
                : `${onlineRecords.length} order(s) · 3PL ${salesSummary.onTimeDeliveryRate}%`}
            </span>
          </dd>
        </div>
      </dl>

      <div className="split-layout">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Revenue by Category</h2>
              <p>
                Unified total:{" "}
                <strong>{formatPHP(salesSummary.totalRevenue)}</strong> across{" "}
                {salesSummary.totalOrders} order(s)
              </p>
            </div>
            <Badge tone="info">
              Avg {formatPHP(salesSummary.averageOrderValue)}
            </Badge>
          </div>
          <div className="panel-body">
            {salesSummary.revenueByCategory.map((bar) => (
              <div className="chart-row" key={bar.category}>
                <span className="chart-label" style={{ width: 120 }}>
                  {bar.category}
                </span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${Math.round((bar.revenue / maxCategoryRev) * 100)}%`,
                    }}
                  />
                </div>
                <span className="chart-value" style={{ width: 84 }}>
                  {formatPHP(bar.revenue)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>PCI DSS &amp; GDPR Rules</h2>
              <p>Active: {ROLE_LABELS[currentRole]}</p>
            </div>
            <Badge tone="success">
              <LockKeyhole size={13} />
              Zero raw PANs
            </Badge>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Cards</th>
                  <th>Privacy</th>
                </tr>
              </thead>
              <tbody>
                {roleCompare.map((row) => (
                  <tr
                    key={row.role}
                    className={
                      currentRole === row.role ? "matrix-highlight" : ""
                    }
                  >
                    <td>
                      <strong>{row.label}</strong>
                    </td>
                    <td>{row.scope}</td>
                    <td className="mono">{row.pci}</td>
                    <td>{row.gdpr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-body live-proof-footer">
            <span>
              <strong>Live output:</strong>{" "}
              {sampleOptIn
                ? `${sampleOptIn.fullName} · ${sampleOptIn.email} · ${sampleOptIn.maskedCardOnFile}`
                : "No customer in scope"}
              {sampleOptOut
                ? ` | Opted-Out: ${sampleOptOut.email} (${sampleOptOut.personalizedOffer.status})`
                : ""}
            </span>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Tamper-Proof Activity Log</h2>
            <p>Append-only PostgreSQL log signed with SHA-256 hashes</p>
          </div>
          <Badge tone={auditIntegrity ? "success" : "danger"}>
            <CheckCircle2 size={13} />
            {auditIntegrity ? "SHA-256 Chain Verified" : "Integrity Warning"}
          </Badge>
        </div>
        {!auditLogs.length ? (
          <EmptyState title="No events recorded yet">
            Trigger a scenario on Live Flow to append a signed entry.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>What happened</th>
                  <th>Who</th>
                  <th>Time &amp; Signature</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 8).map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{actionText[l.action] || l.action}</strong>
                      <span className="muted">{l.details}</span>
                    </td>
                    <td>{l.actorName}</td>
                    <td>
                      {formatTime(l.timestamp)}
                      <span className="muted mono">
                        {l.hash ? `${l.hash.slice(0, 12)}…` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <button
          type="button"
          className="drawer-toggle"
          aria-expanded={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <div>
            <strong>Data Feeds &amp; Batch Import</strong>
            <span className="muted small">
              View all 5 raw PostgreSQL tables, full CDC event stream, or upload
              CSV/JSON files
            </span>
          </div>
          {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showAdvanced && (
          <div className="panel-body advanced-drawer-body">
            <div>
              <div className="section-subhead" style={{ marginBottom: 10 }}>
                <h3>5-Source Record Inspector</h3>
                <div className="feed-tabs">
                  {(
                    [
                      ["POS", sourceCounts.POS],
                      ["INVENTORY", sourceCounts.INVENTORY],
                      ["CRM", sourceCounts.CRM],
                      ["ONLINE", sourceCounts.ONLINE],
                      ["LOGISTICS", sourceCounts.LOGISTICS],
                    ] as const
                  ).map(([feed, count]) => (
                    <button
                      key={feed}
                      className={inspectFeed === feed ? "active" : ""}
                      onClick={() => setInspectFeed(feed)}
                    >
                      {feed} ({count})
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-wrap" style={{ maxHeight: 260 }}>
                {inspectFeed === "POS" && (
                  <table>
                    <thead>
                      <tr>
                        <th>TX ID</th>
                        <th>Branch</th>
                        <th>Customer</th>
                        <th>SKU</th>
                        <th>Total</th>
                        <th>Card (PCI)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posRecords.map((p) => (
                        <tr key={p.txId}>
                          <td className="mono">{p.txId}</td>
                          <td>{p.branch}</td>
                          <td className="mono">{p.customerId}</td>
                          <td>
                            {p.sku} × {p.quantity}
                          </td>
                          <td>{formatPHP(p.totalAmount)}</td>
                          <td className="mono">{p.cardNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {inspectFeed === "INVENTORY" && (
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th>Manila</th>
                        <th>Cebu</th>
                        <th>Online</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryRecords.map((i) => (
                        <tr key={i.sku}>
                          <td className="mono">{i.sku}</td>
                          <td>
                            <div className="table-product-cell">
                              <span className="product-thumb-inline is-xs">
                                <ProductImage
                                  src={i.thumbnail}
                                  alt={i.productName}
                                  size={28}
                                />
                              </span>
                              <span>{i.productName}</span>
                            </div>
                          </td>
                          <td>{i.manilaStock}</td>
                          <td>{i.cebuStock}</td>
                          <td>{i.warehouseStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {inspectFeed === "CRM" && (
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email (GDPR)</th>
                        <th>Tier</th>
                        <th>Consent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crmRecords.map((c) => (
                        <tr key={c.customerId}>
                          <td className="mono">{c.customerId}</td>
                          <td>{c.fullName}</td>
                          <td>{c.email}</td>
                          <td>{c.loyaltyTier}</td>
                          <td>{c.gdprConsent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {inspectFeed === "ONLINE" && (
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>SKU</th>
                        <th>Total</th>
                        <th>Card (PCI)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onlineRecords.map((o) => (
                        <tr key={o.orderId}>
                          <td className="mono">{o.orderId}</td>
                          <td className="mono">{o.customerId}</td>
                          <td>
                            {o.sku} × {o.quantity}
                          </td>
                          <td>{formatPHP(o.totalAmount)}</td>
                          <td className="mono">{o.cardNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {inspectFeed === "LOGISTICS" && (
                  <table>
                    <thead>
                      <tr>
                        <th>Shipment</th>
                        <th>Order</th>
                        <th>Carrier</th>
                        <th>Tracking</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logisticsRecords.map((l) => (
                        <tr key={l.shipmentId}>
                          <td className="mono">{l.shipmentId}</td>
                          <td className="mono">{l.orderId}</td>
                          <td>{l.carrier}</td>
                          <td className="mono">{l.trackingNumber}</td>
                          <td>{l.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="split-layout">
              <div>
                <h3 style={{ marginBottom: 10 }}>Recent CDC Events</h3>
                <div className="table-wrap" style={{ maxHeight: 220 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Summary</th>
                        <th>Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cdcEvents.slice(0, 8).map((ev) => (
                        <tr key={ev.id}>
                          <td>
                            <Badge tone="info">{ev.integrationMethod}</Badge>
                          </td>
                          <td>{ev.summary}</td>
                          <td className="mono">{ev.latencyMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 style={{ marginBottom: 10 }}>
                  Batch CSV / JSON Upload ({isOps ? "Ops enabled" : "Read-only"})
                </h3>
                {isOps ? (
                  <>
                    <div className="upload-controls">
                      <label htmlFor="adv-feed">Destination feed</label>
                      <select
                        id="adv-feed"
                        value={uploadFeed}
                        disabled={isSyncing}
                        onChange={(e) => setUploadFeed(e.target.value as Feed)}
                      >
                        {(Object.keys(feedTemplates) as Feed[]).map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      className={`upload-zone${dragging ? " dragging" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                    >
                      <Upload size={18} />
                      <label className="button secondary">
                        Upload {uploadFeed} CSV or JSON
                        <input
                          type="file"
                          accept=".csv,.json"
                          hidden
                          disabled={isSyncing}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void importFile(uploadFeed, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <div className="template-links">
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => downloadTemplate(uploadFeed, "csv")}
                      >
                        Download {uploadFeed} CSV template
                      </button>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => downloadTemplate(uploadFeed, "json")}
                      >
                        JSON template
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="inline-note">
                    <ShieldCheck size={15} /> Requires Store Operations
                    permission to upload CSV/JSON feeds.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
