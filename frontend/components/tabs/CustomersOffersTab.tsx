"use client";
import { useState } from "react";
import {
  CreditCard,
  Lock,
  Mail,
  Receipt,
  Search,
  ShieldCheck,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import {
  BRANCHES,
  CATEGORIES,
  formatPHP,
  ROLE_LABELS,
  type Branch,
  type ProductCategory,
} from "@/shared/retail";
import type { CRMRecord, UnifiedCustomerRecord } from "@/shared/types";
import {
  Badge,
  EmptyState,
  Modal,
  PageHeading,
  ProductImage,
  ReportLink,
  formatTime,
} from "@/frontend/components/ui";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

export function CustomersOffersTab() {
  const {
    currentRole,
    branchScope,
    customers,
    stockItems,
    isSyncing,
    viewCustomer,
    createCustomer,
    toggleGDPRConsent,
  } = useEDM();

  const stockMap = new Map(stockItems.map((s) => [s.sku, s]));

  const [query, setQuery] = useState("");
  const [gdprFilter, setGdprFilter] = useState<"ALL" | "Opted In" | "Opted Out">(
    "ALL",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBranch, setNewBranch] = useState<Branch>("Manila");
  const [newCategory, setNewCategory] =
    useState<ProductCategory>("Beauty & Fragrance");
  const [newTier, setNewTier] = useState<CRMRecord["loyaltyTier"]>("Gold");
  const [newConsent, setNewConsent] =
    useState<CRMRecord["gdprConsent"]>("Opted In");

  const canToggleGDPR =
    currentRole === "OPS_MANAGER" || currentRole === "MARKETING_CRM";

  const activeOffersCount = customers.filter(
    (c) => c.personalizedOffer.status === "Active",
  ).length;
  const blockedOffersCount = customers.length - activeOffersCount;

  const visibleCustomers = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.customerId.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    const matchesGdpr =
      gdprFilter === "ALL" || c.gdprConsent === gdprFilter;
    return matchesQ && matchesGdpr;
  });

  const selected: UnifiedCustomerRecord | undefined = selectedId
    ? customers.find((c) => c.customerId === selectedId)
    : undefined;

  const roleHint: Record<string, string> = {
    OPS_MANAGER:
      "Full Customer 360 view with PCI DSS tokenized cards (last 4 only) and GDPR controls.",
    MARKETING_CRM:
      "Marketing view: Card numbers are [PCI DSS Restricted], and Opted-Out contact info & offers are blocked.",
    BRANCH_MANAGER:
      "Manila Branch scope: Shows only Manila shoppers with emails and phone numbers masked for privacy.",
    COMPLIANCE_AUDITOR:
      "Auditor view: Identities are pseudonymized (Customer #01..#06) and all payment/contact PII is masked.",
  };

  return (
    <div className="page-stack">
      <PageHeading
        title={
          branchScope
            ? `${branchScope} Customers & Offers`
            : "Customers & Personalized Offers"
        }
        description={
          currentRole === "OPS_MANAGER"
            ? "Unified customer profiles across in-store POS and online orders, with PCI DSS card masking and GDPR offer consent."
            : `${ROLE_LABELS[currentRole]} — ${roleHint[currentRole]}`
        }
        action={
          canToggleGDPR ? (
            <button
              type="button"
              className="button primary"
              disabled={isSyncing}
              onClick={() => setNewCustomerOpen(true)}
            >
              <UserPlus size={15} />
              New Customer
            </button>
          ) : undefined
        }
      />

      <dl className="metric-strip cols-3">
        <div className="metric-cell">
          <dt>Customers in view</dt>
          <dd>{customers.length}</dd>
        </div>
        <div className="metric-cell">
          <dt>Active personalized offers</dt>
          <dd>{activeOffersCount}</dd>
        </div>
        <div className="metric-cell">
          <dt>Blocked by GDPR Opt-Out</dt>
          <dd className="text-warning">{blockedOffersCount}</dd>
        </div>
      </dl>

      <div className="customers-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search customers"
            placeholder="Search by customer name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="search-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="feed-tabs" role="tablist" aria-label="Filter GDPR consent">
          {(["ALL", "Opted In", "Opted Out"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={gdprFilter === f}
              className={gdprFilter === f ? "active" : ""}
              onClick={() => setGdprFilter(f)}
            >
              {f === "ALL" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {!visibleCustomers.length ? (
        <EmptyState title="No customers match filter">
          Clear the search or GDPR filter to view customers.
        </EmptyState>
      ) : (
        <div className="customer-card-grid">
          {visibleCustomers.map((c) => {
            const isOfferActive = c.personalizedOffer.status === "Active";
            return (
              <article key={c.customerId} className="customer-card">
                <div className="customer-card-top">
                  <div className="student-identity">
                    <span className="avatar" aria-hidden="true">
                      {initials(c.fullName)}
                    </span>
                    <div>
                      <h3>{c.fullName}</h3>
                      <span className="muted small">
                        <span className="mono">{c.customerId}</span> ·{" "}
                        {c.loyaltyTier} ({c.pointsBalance.toLocaleString()} pts) ·{" "}
                        {c.preferredBranch}
                      </span>
                    </div>
                  </div>
                  <Badge tone={c.gdprConsent === "Opted In" ? "success" : "warning"}>
                    {c.gdprConsent}
                  </Badge>
                </div>

                <div
                  className={`offer-band ${isOfferActive ? "is-active" : "is-blocked"}`}
                >
                  <div className="offer-band-head">
                    {isOfferActive ? <Tag size={14} /> : <Lock size={14} />}
                    <strong>
                      {isOfferActive
                        ? c.personalizedOffer.title
                        : "Offer Blocked (GDPR Opt-Out)"}
                    </strong>
                    {isOfferActive && (
                      <span className="mono offer-code">
                        {c.personalizedOffer.offerCode}
                      </span>
                    )}
                  </div>
                  <small>{c.personalizedOffer.reason}</small>
                </div>

                <div className="customer-meta-rows">
                  <div className="customer-meta-pair">
                    <span className="customer-meta-item">
                      <Mail size={13} />
                      {c.email}
                    </span>
                    <span className="customer-meta-item mono">
                      <CreditCard size={13} />
                      {c.maskedCardOnFile}
                    </span>
                  </div>
                  <div className="customer-spend-strip">
                    <span>
                      In-Store <strong>{formatPHP(c.posSpend)}</strong>
                    </span>
                    <span>+</span>
                    <span>
                      Online <strong>{formatPHP(c.onlineSpend)}</strong>
                    </span>
                    <span>=</span>
                    <span>
                      Lifetime <strong>{formatPHP(c.totalSpend)}</strong>
                    </span>
                  </div>
                </div>

                <div className="customer-card-footer">
                  <button
                    type="button"
                    className="button secondary"
                    style={{ minHeight: 34, padding: "5px 12px" }}
                    disabled={!canToggleGDPR || isSyncing}
                    title={
                      !canToggleGDPR
                        ? "Requires Store Operations or Marketing permission"
                        : undefined
                    }
                    onClick={() => void toggleGDPRConsent(c.customerId)}
                  >
                    <ShieldCheck size={14} />
                    {c.gdprConsent === "Opted In"
                      ? "Switch to Opted Out"
                      : "Switch to Opted In"}
                  </button>

                  <button
                    type="button"
                    className="button quiet"
                    style={{ minHeight: 34, padding: "5px 10px" }}
                    onClick={() => {
                      setSelectedId(c.customerId);
                      void viewCustomer(c.customerId);
                    }}
                  >
                    <Receipt size={14} />
                    Receipts &amp; Export
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <Modal
          title={`${selected.fullName} · Receipts & Export`}
          wide
          onClose={() => setSelectedId(null)}
        >
          <div className="modal-body">
            <div className="detail-top">
              <div className="student-identity">
                <span className="avatar" aria-hidden="true">
                  {initials(selected.fullName)}
                </span>
                <div>
                  <h3>{selected.fullName}</h3>
                  <span className="mono">
                    {selected.customerId} · {selected.loyaltyTier} · GDPR{" "}
                    {selected.gdprConsent}
                  </span>
                </div>
              </div>
              <div className="heading-actions">
                <ReportLink
                  kind="json"
                  customerId={selected.customerId}
                  label="JSON"
                />
                <ReportLink
                  kind="customer"
                  customerId={selected.customerId}
                  label="PDF"
                />
              </div>
            </div>

            <dl className="detail-fields">
              <div>
                <dt>Email (GDPR)</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt>Phone (GDPR)</dt>
                <dd>{selected.phone}</dd>
              </div>
              <div>
                <dt>Card on file (PCI DSS)</dt>
                <dd className="mono">{selected.maskedCardOnFile}</dd>
              </div>
              <div>
                <dt>Lifetime spend</dt>
                <dd>{formatPHP(selected.totalSpend)}</dd>
              </div>
            </dl>

            <section className="detail-section">
              <h3 style={{ marginBottom: 12 }}>Purchase &amp; 3PL Receipts</h3>
              {!selected.posTransactions.length &&
              !selected.onlineOrders.length ? (
                <p className="small muted">
                  No purchases visible in this role’s scope.
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Channel</th>
                        <th>Item</th>
                        <th>Amount</th>
                        <th>Payment (PCI DSS)</th>
                        <th>Status / 3PL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.posTransactions.map((p) => (
                        <tr key={p.txId}>
                          <td>
                            <strong>{p.branch} POS</strong>
                            <span className="muted mono">{p.txId}</span>
                          </td>
                          <td>
                            <div className="table-product-cell">
                              <span className="product-thumb-inline is-sm">
                                <ProductImage
                                  src={stockMap.get(p.sku)?.thumbnail}
                                  alt={p.productName}
                                  size={32}
                                />
                              </span>
                              <div>
                                {p.productName} × {p.quantity}
                                <span className="muted">
                                  {formatTime(p.timestamp)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>{formatPHP(p.totalAmount)}</td>
                          <td className="mono">
                            {p.paymentMethod} · {p.cardNumber}
                          </td>
                          <td>
                            <Badge tone="success">Completed In-Store</Badge>
                          </td>
                        </tr>
                      ))}
                      {selected.onlineOrders.map((o) => {
                        const shp = selected.shipments.find(
                          (s) => s.orderId === o.orderId,
                        );
                        return (
                          <tr key={o.orderId}>
                            <td>
                              <strong>Online Store</strong>
                              <span className="muted mono">{o.orderId}</span>
                            </td>
                            <td>
                              <div className="table-product-cell">
                                <span className="product-thumb-inline is-sm">
                                  <ProductImage
                                    src={stockMap.get(o.sku)?.thumbnail}
                                    alt={o.productName}
                                    size={32}
                                  />
                                </span>
                                <div>
                                  {o.productName} × {o.quantity}
                                  <span className="muted">
                                    {formatTime(o.orderedAt)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>{formatPHP(o.totalAmount)}</td>
                            <td className="mono">
                              {o.paymentMethod} · {o.cardNumber}
                            </td>
                            <td>
                              {shp ? (
                                <Badge
                                  tone={
                                    shp.status === "Delayed"
                                      ? "danger"
                                      : shp.status === "Delivered"
                                        ? "success"
                                        : "info"
                                  }
                                >
                                  {shp.carrier}: {shp.status}
                                </Badge>
                              ) : (
                                <Badge tone="warning">Awaiting 3PL</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </Modal>
      )}

      {newCustomerOpen && (
        <Modal
          title="Register Customer"
          onClose={() => setNewCustomerOpen(false)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await createCustomer({
                fullName: newName,
                email: newEmail,
                phone: newPhone,
                preferredBranch: newBranch,
                favoriteCategory: newCategory,
                loyaltyTier: newTier,
                gdprConsent: newConsent,
              });
              if (ok) {
                setNewCustomerOpen(false);
                setNewName("");
                setNewEmail("");
                setNewPhone("");
              }
            }}
          >
            <div className="form-grid">
              <label>
                Full Name
                <input
                  required
                  minLength={2}
                  placeholder="Elena Bautista"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <label>
                Email Address
                <input
                  required
                  type="email"
                  placeholder="elena.bautista@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </label>
              <label>
                Phone Number
                <input
                  required
                  minLength={5}
                  placeholder="+63 917 555 0401"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </label>
              <label>
                Preferred Branch
                <select
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value as Branch)}
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Favorite Category
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as ProductCategory)
                  }
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Loyalty Tier
                <select
                  value={newTier}
                  onChange={(e) =>
                    setNewTier(e.target.value as CRMRecord["loyaltyTier"])
                  }
                >
                  {(["VIP", "Gold", "Silver", "Bronze"] as const).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                GDPR Marketing Consent
                <select
                  value={newConsent}
                  onChange={(e) =>
                    setNewConsent(e.target.value as CRMRecord["gdprConsent"])
                  }
                >
                  <option value="Opted In">Opted In (Active Offers)</option>
                  <option value="Opted Out">
                    Opted Out (Suppress Promotions)
                  </option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setNewCustomerOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={isSyncing}>
                Save Customer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
