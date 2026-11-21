"use client";
import { useState, type FormEvent } from "react";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Delete,
  Lock,
  Minus,
  PauseCircle,
  Plus,
  Printer,
  Search,
  Smartphone,
  Tag,
  X,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import { canRecordPOSSale } from "@/shared/access";
import {
  buildQuickCashAmounts,
  BRANCHES,
  CATEGORIES,
  formatPHP,
  WALK_IN_CUSTOMER_ID,
  type Branch,
  type ProductCategory,
} from "@/shared/retail";
import type { CheckoutReceipt, UnifiedCustomerRecord } from "@/shared/types";
import type { TabId } from "@/frontend/lib/workspaceAccess";
import {
  Badge,
  EmptyState,
  Modal,
  ProductImage,
  formatTime,
} from "@/frontend/components/ui";

type TenderMethod = "Cash" | "Card" | "GCash";

interface HeldSale {
  id: string;
  label: string;
  branch: Branch;
  customerId: string;
  cart: Record<string, number>;
}

interface CompletedReceiptView {
  receipt: CheckoutReceipt;
  items: Array<{
    title: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  paymentMethod: TenderMethod;
  cashTendered?: number;
  changeDue?: number;
  vatIncluded: number;
}

function previewCustomerDiscount(
  customer: UnifiedCustomerRecord | undefined,
  cartLines: Array<{ category: ProductCategory; lineTotal: number }>,
): { discountAmount: number; promoCode: string } {
  if (!customer || customer.gdprConsent === "Opted Out") {
    return { discountAmount: 0, promoCode: "NONE" };
  }
  const matchingSubtotal = cartLines
    .filter((l) => l.category === customer.favoriteCategory)
    .reduce((sum, l) => sum + l.lineTotal, 0);
  if (matchingSubtotal <= 0) {
    return { discountAmount: 0, promoCode: "NONE" };
  }
  const tag = customer.favoriteCategory.split(" ")[0].toUpperCase().slice(0, 4);
  if (customer.loyaltyTier === "VIP") {
    return {
      discountAmount: Math.round(matchingSubtotal * 0.2),
      promoCode: `VIP-${tag}20`,
    };
  }
  if (customer.loyaltyTier === "Gold") {
    return {
      discountAmount: Math.round(matchingSubtotal * 0.15),
      promoCode: `GOLD-${tag}15`,
    };
  }
  if (customer.loyaltyTier === "Silver") {
    return {
      discountAmount: Math.round(matchingSubtotal * 0.1),
      promoCode: `SILV-${tag}10`,
    };
  }
  return { discountAmount: 0, promoCode: "KARTO-SHIP" };
}

const KEYPAD_KEYS = [
  "7",
  "8",
  "9",
  "4",
  "5",
  "6",
  "1",
  "2",
  "3",
  "C",
  "0",
  "BACK",
] as const;

export function CheckoutTab({
  onNavigate,
}: {
  onNavigate: (tab: TabId) => void;
}) {
  const {
    currentRole,
    branchScope,
    stockItems,
    customers,
    isSyncing,
    processCheckout,
  } = useEDM();

  const cashier = currentRole === "CASHIER";
  const canPOS = canRecordPOSSale(currentRole);

  const [selectedBranch, setSelectedBranch] = useState<Branch>(
    branchScope || "Manila",
  );
  const [query, setQuery] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ProductCategory>(
    "ALL",
  );
  const [cart, setCart] = useState<Record<string, number>>({});
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [selectedCustomerId, setCustomerId] = useState("CUST-001");

  // Two-step Tender & Receipt modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [tenderMethod, setTenderMethod] = useState<TenderMethod>("Cash");
  const [cashInput, setCashInput] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [completedReceipt, setCompletedReceipt] =
    useState<CompletedReceiptView | null>(null);

  const branch = branchScope || selectedBranch;
  const customerId = cashier ? WALK_IN_CUSTOMER_ID : selectedCustomerId;
  const activeCustomer = customers.find((c) => c.customerId === customerId);
  const stockForBranch = (item: (typeof stockItems)[number]) =>
    branch === "Cebu" ? item.cebuStock : item.manilaStock;

  const visibleProducts = stockItems.filter((item) => {
    const q = query.trim().toLowerCase();
    const matchesQ =
      !q ||
      item.productName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.externalSku || "").toLowerCase().includes(q) ||
      (item.brand || "").toLowerCase().includes(q);
    const matchesCat =
      categoryFilter === "ALL" || item.category === categoryFilter;
    return matchesQ && matchesCat;
  });

  const stockMap = new Map(stockItems.map((s) => [s.sku, s]));
  const cleanCart = Object.entries(cart)
    .map(([sku, qty]) => ({ sku, qty, item: stockMap.get(sku) }))
    .filter(
      (
        entry,
      ): entry is {
        sku: string;
        qty: number;
        item: NonNullable<typeof entry.item>;
      } => Boolean(entry.item) && entry.qty > 0,
    );

  const subtotal = cleanCart.reduce(
    (sum, line) => sum + line.item.unitPrice * line.qty,
    0,
  );
  const { discountAmount, promoCode } = previewCustomerDiscount(
    activeCustomer,
    cleanCart.map((line) => ({
      category: line.item.category,
      lineTotal: line.item.unitPrice * line.qty,
    })),
  );
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const vatIncluded = Math.round(totalAmount - totalAmount / 1.12);
  const totalQty = cleanCart.reduce((sum, l) => sum + l.qty, 0);

  const updateCartQty = (sku: string, delta: number) => {
    const item = stockMap.get(sku);
    if (
      cashier &&
      delta > 0 &&
      item &&
      (cart[sku] || 0) >= stockForBranch(item)
    ) {
      setScanMessage(`No more ${item.productName} available at ${branch}.`);
      return false;
    }
    setCart((prev) => {
      const next = (prev[sku] || 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[sku];
        return copy;
      }
      return { ...prev, [sku]: Math.min(50, next) };
    });
    return true;
  };

  const handleScanSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;
    const exactMatch = stockItems.find(
      (item) =>
        item.sku.toLowerCase() === q ||
        (item.externalSku || "").toLowerCase() === q,
    );
    const target =
      exactMatch ||
      (visibleProducts.length === 1 ? visibleProducts[0] : undefined);
    if (!target) {
      setScanMessage(`No exact SKU match for "${query.trim()}".`);
      return;
    }
    if (updateCartQty(target.sku, 1)) {
      setQuery("");
      setScanMessage(`Scanned +1 ${target.productName}`);
    }
  };

  const handleHoldSale = () => {
    if (!cleanCart.length) return;
    const name = activeCustomer?.fullName || "Walk-In";
    const held: HeldSale = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      label: `${name} (${totalQty})`,
      branch,
      customerId,
      cart: { ...cart },
    };
    setHeldSales((prev) => [held, ...prev]);
    setCart({});
    setScanMessage(`Parked ${held.label}.`);
  };

  const handleResumeHeld = () => {
    const [latest, ...rest] = heldSales;
    if (!latest) return;
    setHeldSales(rest);
    setSelectedBranch(latest.branch);
    setCustomerId(latest.customerId);
    setCart(latest.cart);
    setScanMessage(`Resumed ${latest.label}.`);
  };

  const openChargeModal = () => {
    setCompletedReceipt(null);
    setTenderMethod("Cash");
    setCashInput("");
    setCardNumber("");
    setPaymentModalOpen(true);
  };

  const handleKeypadPress = (key: (typeof KEYPAD_KEYS)[number]) => {
    if (key === "C") {
      setCashInput("");
      return;
    }
    if (key === "BACK") {
      setCashInput((prev) => prev.slice(0, -1));
      return;
    }
    setCashInput((prev) => {
      const next = (prev === "0" ? "" : prev) + key;
      return next.length > 7 ? prev : next;
    });
  };

  const registerLabel = `${branch} POS`;

  const quickCashAmounts = buildQuickCashAmounts(totalAmount);
  const parsedCash = Number(cashInput || "0") || 0;
  const cashShortBy = Math.max(0, totalAmount - parsedCash);
  const cashChangeDue = Math.max(0, parsedCash - totalAmount);

  const exceedsStock =
    cashier && cleanCart.some(({ item, qty }) => qty > stockForBranch(item));
  const canCharge =
    cleanCart.length > 0 && !isSyncing && canPOS && !exceedsStock;

  const canCompleteTender =
    canCharge && (tenderMethod !== "Cash" || parsedCash >= totalAmount);

  const handleCompletePayment = async () => {
    if (!canCompleteTender) return;
    const itemSnapshot = cleanCart.map((line) => ({
      title: line.item.productName,
      qty: line.qty,
      unitPrice: line.item.unitPrice,
      lineTotal: line.item.unitPrice * line.qty,
    }));
    const cashUsed = tenderMethod === "Cash" ? parsedCash : undefined;
    const changeAmt = tenderMethod === "Cash" ? cashChangeDue : 0;

    const receipt = await processCheckout({
      branch,
      customerId,
      paymentMethod: tenderMethod,
      ...(tenderMethod === "Card" && cardNumber.trim()
        ? { cardNumber: cardNumber.trim() }
        : {}),
      items: cleanCart.map((l) => ({ sku: l.sku, quantity: l.qty })),
    });

    if (receipt) {
      setCompletedReceipt({
        receipt,
        items: itemSnapshot,
        paymentMethod: tenderMethod,
        cashTendered: cashUsed,
        changeDue: changeAmt,
        vatIncluded,
      });
      setCart({});
      setCashInput("");
      setCardNumber("");
    }
  };

  return (
    <div className="pos-shell">
      {/* Compact Register Header Bar */}
      <div className="pos-topbar">
        <div className="pos-topbar-left">
          <div
            className="feed-tabs"
            role="tablist"
            aria-label="Select POS register"
          >
            {(cashier ? [branch] : BRANCHES).map((registerBranch) => (
              <button
                key={registerBranch}
                type="button"
                role="tab"
                disabled={Boolean(
                  branchScope && branchScope !== registerBranch,
                )}
                aria-selected={branch === registerBranch}
                className={branch === registerBranch ? "active" : ""}
                onClick={() => setSelectedBranch(registerBranch)}
              >
                {registerBranch} POS
              </button>
            ))}
          </div>
          <span className="pos-terminal-tag">Register #01 · VAT Incl.</span>
        </div>

        <div className="pos-topbar-right">
          {scanMessage && (
            <span className="pos-scan-toast" role="status">
              {scanMessage}
            </span>
          )}
          {heldSales.length > 0 && (
            <button
              type="button"
              className="button secondary"
              style={{ minHeight: 34, padding: "5px 12px" }}
              onClick={handleResumeHeld}
              title={`Resume ${heldSales[0]?.label}`}
            >
              <PauseCircle size={14} />
              {heldSales.length} Held
            </button>
          )}
        </div>
      </div>

      {/* Main Split-Screen Register */}
      <div className="checkout-layout">
        {/* Left: Touch Product Grid */}
        <section className="checkout-catalog" aria-label="Register item grid">
          <div className="checkout-toolbar">
            <form className="search-field" onSubmit={handleScanSubmit}>
              <Search size={16} />
              <input
                aria-label="Scan barcode SKU or search products"
                placeholder="Scan SKU (e.g. SKU-103) or search product…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (scanMessage) setScanMessage(null);
                }}
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </form>

            <div
              className="feed-tabs"
              role="tablist"
              aria-label="Category filter"
            >
              {(["ALL", ...CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={categoryFilter === cat}
                  className={categoryFilter === cat ? "active" : ""}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === "ALL" ? "All" : cat}
                </button>
              ))}
            </div>
          </div>

          {!visibleProducts.length ? (
            <EmptyState title="No items match your search">
              Clear your search or choose a different category.
            </EmptyState>
          ) : (
            <div className="pos-grid">
              {visibleProducts.map((item) => {
                const qtyInCart = cart[item.sku] || 0;
                const branchQty = stockForBranch(item);
                return (
                  <button
                    key={item.sku}
                    type="button"
                    disabled={isSyncing || (cashier && qtyInCart >= branchQty)}
                    className={`pos-tile${qtyInCart > 0 ? " is-selected" : ""}`}
                    onClick={() => updateCartQty(item.sku, 1)}
                  >
                    {qtyInCart > 0 && (
                      <span
                        className="pos-tile-qty"
                        aria-label={`${qtyInCart} in sale`}
                      >
                        {qtyInCart}
                      </span>
                    )}
                    <div className="pos-tile-media">
                      <ProductImage
                        src={item.thumbnail}
                        alt={item.productName}
                        size={110}
                      />
                    </div>
                    <div className="pos-tile-body">
                      <h3>{item.productName}</h3>
                      <small className="muted">
                        {item.brand || "Karto"} ·{" "}
                        <span className="mono">{item.sku}</span>
                      </small>
                      <div className="pos-tile-foot">
                        <strong>{formatPHP(item.unitPrice)}</strong>
                        <span
                          className={
                            branchQty <= 0
                              ? "text-danger"
                              : branchQty <= 4
                                ? "text-warning"
                                : "muted"
                          }
                        >
                          {branchQty <= 0 ? "Out" : `${branchQty} left`}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: Persistent Running Sale Ticket */}
        <aside className="panel pos-ticket" aria-label="Current sale ticket">
          <div className="pos-ticket-head">
            <div>
              <h2>Current Sale</h2>
              <small className="muted">
                {totalQty} item(s) · {registerLabel}
              </small>
            </div>
            <div className="pos-ticket-actions">
              <button
                type="button"
                className="button quiet"
                disabled={!cleanCart.length || isSyncing}
                onClick={handleHoldSale}
              >
                Hold
              </button>
              <button
                type="button"
                className="button quiet"
                disabled={!cleanCart.length || isSyncing}
                onClick={() => setCart({})}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="pos-ticket-customer">
            {cashier ? (
              <strong>Walk-in sale</strong>
            ) : (
              <label className="checkout-field">
                <span>Customer</span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value={WALK_IN_CUSTOMER_ID}>Walk-In Customer</option>
                  {customers.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName} ({c.loyaltyTier} · {c.gdprConsent})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {activeCustomer && (
              <div
                className={`checkout-offer-notice ${
                  activeCustomer.gdprConsent === "Opted Out"
                    ? "is-blocked"
                    : discountAmount > 0
                      ? "is-active"
                      : ""
                }`}
              >
                {activeCustomer.gdprConsent === "Opted Out" ? (
                  <>
                    <Lock size={13} />
                    <span>GDPR Opt-Out · Promo disabled</span>
                  </>
                ) : discountAmount > 0 ? (
                  <>
                    <Tag size={13} />
                    <span>
                      <strong>{promoCode}</strong> · -
                      {formatPHP(discountAmount)} off{" "}
                      {activeCustomer.favoriteCategory}
                    </span>
                  </>
                ) : (
                  <>
                    <Tag size={13} />
                    <span>
                      {activeCustomer.loyaltyTier} · Favorite:{" "}
                      {activeCustomer.favoriteCategory}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="pos-ticket-list">
            {!cleanCart.length ? (
              <p className="pos-ticket-empty">
                Tap any product tile on the left or scan a SKU to ring up an
                item.
              </p>
            ) : (
              cleanCart.map(({ sku, qty, item }) => (
                <div key={sku} className="checkout-cart-row">
                  <span className="product-thumb-inline is-sm">
                    <ProductImage
                      src={item.thumbnail}
                      alt={item.productName}
                      size={32}
                    />
                  </span>
                  <div className="checkout-cart-info">
                    <strong>{item.productName}</strong>
                    <small className="muted">
                      {formatPHP(item.unitPrice)} each
                    </small>
                  </div>
                  <div className="qty-stepper">
                    <button
                      type="button"
                      aria-label={`Decrease ${item.productName}`}
                      onClick={() => updateCartQty(sku, -1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span>{qty}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${item.productName}`}
                      disabled={cashier && qty >= stockForBranch(item)}
                      onClick={() => updateCartQty(sku, 1)}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="pos-line-total">
                    {formatPHP(item.unitPrice * qty)}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${item.productName}`}
                    onClick={() => updateCartQty(sku, -qty)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pos-ticket-footer">
            <dl className="checkout-summary">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPHP(subtotal)}</dd>
              </div>
              {discountAmount > 0 && (
                <div>
                  <dt>Promo ({promoCode})</dt>
                  <dd className="text-success">-{formatPHP(discountAmount)}</dd>
                </div>
              )}
              <div>
                <dt>VAT (12% incl.)</dt>
                <dd>{formatPHP(vatIncluded)}</dd>
              </div>
              <div className="checkout-total-row">
                <dt>Amount Due</dt>
                <dd>{formatPHP(totalAmount)}</dd>
              </div>
            </dl>

            {exceedsStock && (
              <p className="text-warning" role="status">
                Stock changed. Reduce the quantities in this sale to continue.
              </p>
            )}
            <button
              type="button"
              className="button primary pos-charge-btn"
              disabled={!canCharge}
              onClick={openChargeModal}
            >
              Charge {formatPHP(totalAmount)}
            </button>
          </div>
        </aside>
      </div>

      {/* Step 2 & Step 3: Take Payment / Thermal Receipt Modal */}
      {paymentModalOpen && (
        <Modal
          title={completedReceipt ? "Receipt" : "Take Payment"}
          onClose={() => {
            setPaymentModalOpen(false);
            setCompletedReceipt(null);
          }}
        >
          {completedReceipt ? (
            <div className="modal-body tender-modal-body">
              <div className="pos-receipt-paper">
                <div className="pos-receipt-brand">
                  <CheckCircle2 size={22} className="text-success" />
                  <strong>KARTO</strong>
                  <small>
                    {completedReceipt.receipt.branch} Branch · POS Register #01
                  </small>
                  <span className="muted mono">
                    {completedReceipt.receipt.referenceIds.join(", ")} ·{" "}
                    {formatTime(completedReceipt.receipt.timestamp)}
                  </span>
                  <span>Customer: {completedReceipt.receipt.customerName}</span>
                </div>

                <hr className="pos-receipt-divider" />

                <div className="pos-receipt-items">
                  {completedReceipt.items.map((line) => (
                    <div key={line.title} className="pos-receipt-line">
                      <span>
                        {line.qty}× {line.title}
                      </span>
                      <strong>{formatPHP(line.lineTotal)}</strong>
                    </div>
                  ))}
                </div>

                <hr className="pos-receipt-divider" />

                <dl className="pos-receipt-totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{formatPHP(completedReceipt.receipt.subtotal)}</dd>
                  </div>
                  {completedReceipt.receipt.discountAmount > 0 && (
                    <div>
                      <dt>Promo ({completedReceipt.receipt.promoCode})</dt>
                      <dd className="text-success">
                        -{formatPHP(completedReceipt.receipt.discountAmount)}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>VAT (12% incl.)</dt>
                    <dd>{formatPHP(completedReceipt.vatIncluded)}</dd>
                  </div>
                  <div className="is-grand">
                    <dt>TOTAL PAID</dt>
                    <dd>{formatPHP(completedReceipt.receipt.totalAmount)}</dd>
                  </div>

                  {completedReceipt.paymentMethod === "Cash" &&
                  typeof completedReceipt.cashTendered === "number" ? (
                    <>
                      <div>
                        <dt>Cash Tendered</dt>
                        <dd>{formatPHP(completedReceipt.cashTendered)}</dd>
                      </div>
                      <div className="is-change">
                        <dt>CHANGE DUE</dt>
                        <dd>{formatPHP(completedReceipt.changeDue ?? 0)}</dd>
                      </div>
                    </>
                  ) : (
                    <div>
                      <dt>Payment ({completedReceipt.paymentMethod})</dt>
                      <dd className="mono">
                        {completedReceipt.receipt.maskedCard}
                      </dd>
                    </div>
                  )}

                  {completedReceipt.receipt.pointsEarned > 0 && (
                    <div>
                      <dt>Loyalty Earned</dt>
                      <dd>
                        +
                        {completedReceipt.receipt.pointsEarned.toLocaleString()}{" "}
                        pts
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="pos-receipt-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => window.print()}
                >
                  <Printer size={15} />
                  Print Receipt
                </button>
                {!cashier && (
                  <button
                    type="button"
                    className="button quiet"
                    onClick={() => {
                      setPaymentModalOpen(false);
                      setCompletedReceipt(null);
                      onNavigate("stock");
                    }}
                  >
                    View Stock
                  </button>
                )}
                <button
                  type="button"
                  className="button primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setPaymentModalOpen(false);
                    setCompletedReceipt(null);
                  }}
                >
                  New Sale
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-body tender-modal-body">
              <div className="tender-due">
                <span className="muted">Amount Due</span>
                <strong>{formatPHP(totalAmount)}</strong>
                <small className="muted">
                  {totalQty} item(s) · {registerLabel} ·{" "}
                  {activeCustomer?.fullName || "Walk-In Customer"}
                </small>
              </div>

              <div
                className="tender-method-grid"
                role="radiogroup"
                aria-label="Payment tender method"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={tenderMethod === "Cash"}
                  className={`tender-method-btn${tenderMethod === "Cash" ? " is-active" : ""}`}
                  onClick={() => setTenderMethod("Cash")}
                >
                  <Banknote size={18} />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tenderMethod === "Card"}
                  className={`tender-method-btn${tenderMethod === "Card" ? " is-active" : ""}`}
                  onClick={() => setTenderMethod("Card")}
                >
                  <CreditCard size={18} />
                  <span>Card (Tap/Chip)</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tenderMethod === "GCash"}
                  className={`tender-method-btn${tenderMethod === "GCash" ? " is-active" : ""}`}
                  onClick={() => setTenderMethod("GCash")}
                >
                  <Smartphone size={18} />
                  <span>GCash</span>
                </button>
              </div>

              {tenderMethod === "Cash" && (
                <div className="cash-tender-section">
                  <div className="quick-cash-row">
                    {quickCashAmounts.map((amt, idx) => (
                      <button
                        key={amt}
                        type="button"
                        className={`quick-cash-btn${parsedCash === amt ? " is-selected" : ""}`}
                        onClick={() => setCashInput(String(amt))}
                      >
                        {idx === 0 ? `Exact ${formatPHP(amt)}` : formatPHP(amt)}
                      </button>
                    ))}
                  </div>

                  <div className="cash-keypad-wrap">
                    <div
                      className="cash-keypad"
                      aria-label="Cash amount keypad"
                    >
                      {KEYPAD_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          className="cash-keypad-key"
                          onClick={() => handleKeypadPress(key)}
                        >
                          {key === "BACK" ? <Delete size={16} /> : key}
                        </button>
                      ))}
                    </div>

                    <div className="change-due-panel">
                      <div>
                        <span>Cash Tendered</span>
                        <strong>{formatPHP(parsedCash)}</strong>
                      </div>
                      <div className="change-due-result">
                        <span>
                          {parsedCash >= totalAmount
                            ? "Change Due"
                            : "Remaining"}
                        </span>
                        <strong
                          className={
                            parsedCash >= totalAmount
                              ? "text-success"
                              : "text-warning"
                          }
                        >
                          {parsedCash >= totalAmount
                            ? formatPHP(cashChangeDue)
                            : formatPHP(cashShortBy)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tenderMethod === "Card" && (
                <div className="card-tender-box">
                  <div className="card-tender-head">
                    <span>Tap, insert EMV chip, or enter card number</span>
                    <Badge tone="success">PCI DSS Tokenized</Badge>
                  </div>
                  <label className="checkout-field">
                    <span>Card Number (Optional test entry)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={23}
                      placeholder="4532 8910 4421 4242"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </label>
                </div>
              )}

              {tenderMethod === "GCash" && (
                <div className="wallet-tender-note">
                  Ready to confirm <strong>GCash</strong> QR / instant wallet
                  payment for {formatPHP(totalAmount)}.
                </div>
              )}

              <button
                type="button"
                className="button primary pos-charge-btn"
                disabled={!canCompleteTender}
                onClick={() => void handleCompletePayment()}
              >
                Complete Sale · {formatPHP(totalAmount)}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
