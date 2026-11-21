"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Search,
  ShoppingCart,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { CARRIERS, CATEGORIES, formatPHP, type Carrier, type ProductCategory } from "@/shared/retail";
import type {
  CheckoutReceipt,
  ShopperSummary,
  ShopSnapshot,
  UnifiedStockItem,
} from "@/shared/types";
import { BrandMark } from "./BrandMark";
import { ProductImage } from "./ui";
import { broadcastDataChange, subscribeDataChanges } from "@/frontend/lib/liveSync";
import "./ShopStorefront.css";

interface BagLine {
  sku: string;
  quantity: number;
}

function previewShopDiscount(
  shopper: ShopperSummary | undefined,
  lines: Array<{ product: UnifiedStockItem; quantity: number }>,
): { promoCode: string; discountAmount: number; note: string; state: "active" | "suppressed" | "neutral" } {
  if (!shopper) {
    return {
      promoCode: "NONE",
      discountAmount: 0,
      note: "Select a CRM shopper account to check personalized offers.",
      state: "neutral",
    };
  }
  if (shopper.gdprConsent === "Opted Out") {
    return {
      promoCode: "NONE",
      discountAmount: 0,
      note: "Offers disabled (GDPR Opt-Out) — automated profiling blocked.",
      state: "suppressed",
    };
  }
  const matchingSubtotal = lines
    .filter((l) => l.product.category === shopper.favoriteCategory)
    .reduce((sum, l) => sum + l.product.unitPrice * l.quantity, 0);
  const tag = shopper.favoriteCategory.split(" ")[0].toUpperCase().slice(0, 4);

  if (shopper.loyaltyTier === "VIP") {
    const amt = Math.round(matchingSubtotal * 0.2);
    return {
      promoCode: amt > 0 ? `VIP-${tag}20` : "NONE",
      discountAmount: amt,
      note:
        amt > 0
          ? `VIP-` + `${tag}20 applied: -${formatPHP(amt)} off ${shopper.favoriteCategory} (GDPR Opted In)`
          : `VIP Opted In · Add ${shopper.favoriteCategory} items for 20% off.`,
      state: "active",
    };
  }
  if (shopper.loyaltyTier === "Gold") {
    const amt = Math.round(matchingSubtotal * 0.15);
    return {
      promoCode: amt > 0 ? `GOLD-${tag}15` : "NONE",
      discountAmount: amt,
      note:
        amt > 0
          ? `GOLD-${tag}15 applied: -${formatPHP(amt)} off ${shopper.favoriteCategory} (GDPR Opted In)`
          : `Gold Opted In · Add ${shopper.favoriteCategory} items for 15% off.`,
      state: "active",
    };
  }
  if (shopper.loyaltyTier === "Silver") {
    const amt = Math.round(matchingSubtotal * 0.1);
    return {
      promoCode: amt > 0 ? `SILV-${tag}10` : "NONE",
      discountAmount: amt,
      note:
        amt > 0
          ? `SILV-${tag}10 applied: -${formatPHP(amt)} off ${shopper.favoriteCategory} (GDPR Opted In)`
          : `Silver Opted In · Add ${shopper.favoriteCategory} items for 10% off.`,
      state: "active",
    };
  }
  return {
    promoCode: "KARTO-SHIP",
    discountAmount: 0,
    note: `Bronze Opted In (${shopper.loyaltyTier}) · Free 3PL delivery eligibility.`,
    state: "active",
  };
}

function originalPricePhp(item: UnifiedStockItem): number | null {
  const pct = item.discountPercentage ?? 0;
  if (pct <= 1 || pct >= 90) return null;
  const orig = Math.round(item.unitPrice / (1 - pct / 100));
  return orig > item.unitPrice ? orig : null;
}

export function ShopStorefront() {
  const [snapshot, setSnapshot] = useState<ShopSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | ProductCategory>("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState<
    "default" | "price-asc" | "price-desc" | "rating" | "sold"
  >("default");

  const [shopperId, setShopperId] = useState("CUST-001");
  const [bag, setBag] = useState<BagLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickViewSku, setQuickViewSku] = useState<string | null>(null);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const [carrier, setCarrier] = useState<Carrier>("LBC Express");
  const [paymentMethod, setPaymentMethod] = useState<"Card" | "GCash" | "Maya">(
    "Card",
  );
  const [cardNumber, setCardNumber] = useState("4532-8910-4421-4242");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null);

  const submittingRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    let active = true;
    void fetch("/api/shop", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load catalog.");
        return data as ShopSnapshot;
      })
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setError("");
      })
      .catch((e) => {
        if (!active) return;
        setError(
          e instanceof Error ? e.message : "Could not load store catalog.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const stop = subscribeDataChanges(
      () => {
        if (submittingRef.current || refreshingRef.current) return;
        refreshingRef.current = true;
        void fetch("/api/shop", { cache: "no-store" })
          .then(async (res) => {
            if (!res.ok) return null;
            return (await res.json()) as ShopSnapshot;
          })
          .then((data) => {
            if (!active || !data || submittingRef.current) return;
            setSnapshot(data);
          })
          .catch(() => {
            // Silent retry on next sync tick or focus event.
          })
          .finally(() => {
            refreshingRef.current = false;
          });
      },
      { pollMs: 10000 },
    );
    return () => {
      active = false;
      stop();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setQuickViewSku(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const products = useMemo(() => snapshot?.products ?? [], [snapshot]);
  const shoppers = useMemo(() => snapshot?.shoppers ?? [], [snapshot]);
  const productMap = useMemo(
    () => new Map(products.map((p) => [p.sku, p])),
    [products],
  );
  const activeShopper = useMemo(
    () => shoppers.find((s) => s.customerId === shopperId) || shoppers[0],
    [shopperId, shoppers],
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    const list = products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (min !== null && !Number.isNaN(min) && p.unitPrice < min) return false;
      if (max !== null && !Number.isNaN(max) && p.unitPrice > max) return false;
      if (!q) return true;
      return (
        p.productName.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });

    if (sortBy === "price-asc") {
      return [...list].sort((a, b) => a.unitPrice - b.unitPrice);
    }
    if (sortBy === "price-desc") {
      return [...list].sort((a, b) => b.unitPrice - a.unitPrice);
    }
    if (sortBy === "rating") {
      return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
    if (sortBy === "sold") {
      return [...list].sort((a, b) => b.unitsSoldOnline - a.unitsSoldOnline);
    }
    return list;
  }, [products, query, category, minPrice, maxPrice, sortBy]);

  const bagLines = useMemo(
    () =>
      bag
        .map((line) => {
          const product = productMap.get(line.sku);
          return product ? { product, quantity: line.quantity } : null;
        })
        .filter(
          (x): x is { product: UnifiedStockItem; quantity: number } => x !== null,
        ),
    [bag, productMap],
  );

  const totalBagCount = bagLines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = bagLines.reduce(
    (sum, l) => sum + l.product.unitPrice * l.quantity,
    0,
  );
  const offerPreview = previewShopDiscount(activeShopper, bagLines);
  const totalDue = Math.max(0, subtotal - offerPreview.discountAmount);

  const quickViewProduct = quickViewSku ? productMap.get(quickViewSku) : undefined;
  const quickGallery = quickViewProduct
    ? quickViewProduct.images?.length
      ? quickViewProduct.images
      : quickViewProduct.thumbnail
        ? [quickViewProduct.thumbnail]
        : []
    : [];

  const addToBag = (item: UnifiedStockItem) => {
    setReceipt(null);
    setBag((prev) => {
      const existing = prev.find((b) => b.sku === item.sku);
      if (existing) {
        return prev.map((b) =>
          b.sku === item.sku
            ? { ...b, quantity: Math.min(50, b.quantity + 1) }
            : b,
        );
      }
      return [...prev, { sku: item.sku, quantity: 1 }];
    });
    setToast(`Added ${item.productName} to your bag.`);
  };

  const updateBagQty = (sku: string, delta: number) => {
    setBag((prev) =>
      prev
        .map((line) =>
          line.sku === sku
            ? { ...line, quantity: line.quantity + delta }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const placeOrder = async () => {
    if (!bagLines.length || !activeShopper) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: activeShopper.customerId,
          paymentMethod,
          cardNumber: paymentMethod === "Card" ? cardNumber : undefined,
          carrier,
          items: bagLines.map((l) => ({
            sku: l.product.sku,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order could not be placed.");
      setSnapshot(data.catalog as ShopSnapshot);
      setReceipt(data.receipt as CheckoutReceipt);
      setBag([]);
      setToast(data.message || "Online order synced to Karto Hub.");
      broadcastDataChange("shop");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order could not be placed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shop-page">
      <header className="shop-header">
        <div className="shop-header-inner">
          <Link href="/shop" className="shop-brand" aria-label="Karto Shop home">
            <span className="shop-brand-mark">
              <BrandMark size={19} compact />
            </span>
            <strong>KARTO / SHOP</strong>
          </Link>

          <div className="shop-search-wrap">
            <Search size={16} />
            <input
              type="search"
              aria-label="Search products"
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="shop-search-clear"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="shop-header-actions">
            {shoppers.length > 0 && (
              <select
                className="shop-customer-select"
                aria-label="Shopper profile"
                value={activeShopper?.customerId || shopperId}
                onChange={(e) => {
                  setShopperId(e.target.value);
                  setReceipt(null);
                }}
              >
                {shoppers.map((s) => (
                  <option key={s.customerId} value={s.customerId}>
                    {s.fullName} ({s.loyaltyTier} · {s.gdprConsent})
                  </option>
                ))}
              </select>
            )}

            <Link href="/" className="shop-hub-link">
              Karto Hub <ArrowRight size={14} />
            </Link>

            <button
              type="button"
              className="shop-cart-btn"
              aria-label={`Open shopping bag (${totalBagCount} items)`}
              onClick={() => setDrawerOpen(true)}
            >
              <ShoppingCart size={16} />
              <span className="shop-cart-badge">{totalBagCount}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="shop-main">
        {(error || toast) && (
          <div
            className={`shop-toast${error ? " is-error" : ""}`}
            role={error ? "alert" : "status"}
          >
            <span>{error || toast}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => {
                setError("");
                setToast("");
              }}
            >
              <X size={15} />
            </button>
          </div>
        )}

        <section className="shop-filters" aria-label="Catalog filters">
          <div className="shop-filter-group">
            <label htmlFor="shop-category">Category</label>
            <select
              id="shop-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "All" | ProductCategory)
              }
            >
              <option value="All">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="shop-filter-group">
            <label htmlFor="shop-min-price">Price Range (₱)</label>
            <div className="shop-price-range">
              <input
                id="shop-min-price"
                type="number"
                min={0}
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <span>–</span>
              <input
                aria-label="Maximum price"
                type="number"
                min={0}
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="shop-filter-group">
            <label htmlFor="shop-sort">Sort By</label>
            <select
              id="shop-sort"
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as
                    | "default"
                    | "price-asc"
                    | "price-desc"
                    | "rating"
                    | "sold",
                )
              }
            >
              <option value="default">Default</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="sold">Most Sold</option>
            </select>
          </div>
        </section>

        {loading ? (
          <div className="shop-empty" aria-busy="true">
            <h2>Loading Karto Online Catalog…</h2>
            <p>Connecting live to PostgreSQL warehouse stock.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="shop-empty">
            <h2>No products match your filters</h2>
            <p>Clear your search or price range to browse all live SKUs.</p>
          </div>
        ) : (
          <section className="shop-grid" aria-label="Online Storefront Catalog">
            {filteredProducts.map((item) => {
              const was = originalPricePhp(item);
              const inBagQty =
                bag.find((b) => b.sku === item.sku)?.quantity || 0;
              const stockClass =
                item.warehouseStock <= 0
                  ? "is-out"
                  : item.warehouseStock <= 4
                    ? "is-low"
                    : "";

              return (
                <article key={item.sku} className="shop-card">
                  <button
                    type="button"
                    className="shop-card-img-btn"
                    onClick={() => {
                      setQuickViewSku(item.sku);
                      setGalleryIdx(0);
                    }}
                  >
                    <ProductImage
                      src={item.thumbnail}
                      alt={item.productName}
                      size={170}
                    />
                  </button>

                  <button
                    type="button"
                    className="shop-card-title-btn"
                    onClick={() => {
                      setQuickViewSku(item.sku);
                      setGalleryIdx(0);
                    }}
                  >
                    {item.productName}
                  </button>

                  <span className="shop-card-cat">{item.category}</span>

                  <div className="shop-card-price-row">
                    <span className="shop-price-now">
                      {formatPHP(item.unitPrice)}
                    </span>
                    {was && <span className="shop-price-was">{formatPHP(was)}</span>}
                  </div>

                  <div className="shop-card-meta-row">
                    <span className="shop-rating">
                      {(item.rating ?? 4.2).toFixed(2)} <Star size={13} />
                    </span>
                    <span className={`shop-stock ${stockClass}`}>
                      {item.warehouseStock < 0
                        ? `Backorder (${item.warehouseStock})`
                        : `Stock: ${item.warehouseStock}`}
                    </span>
                  </div>

                  <span className="shop-sold">Sold: {item.unitsSoldOnline}</span>

                  <button
                    type="button"
                    className={`shop-add-btn${inBagQty > 0 ? " in-bag" : ""}`}
                    onClick={() => addToBag(item)}
                  >
                    {inBagQty > 0 ? `Add Another (${inBagQty} in bag)` : "Add to Cart"}
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>

      {quickViewProduct && (
        <div
          className="shop-backdrop is-center"
          onClick={() => setQuickViewSku(null)}
        >
          <div
            className="shop-modal"
            role="dialog"
            aria-modal="true"
            aria-label={quickViewProduct.productName}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shop-modal-head">
              <h2>{quickViewProduct.productName}</h2>
              <button
                type="button"
                className="shop-icon-close"
                aria-label="Close product preview"
                onClick={() => setQuickViewSku(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="shop-modal-body">
              <div>
                <div className="shop-gallery-stage">
                  <ProductImage
                    src={
                      quickGallery[galleryIdx] || quickViewProduct.thumbnail
                    }
                    alt={quickViewProduct.productName}
                    size={220}
                  />
                </div>
                {quickGallery.length > 1 && (
                  <div className="shop-gallery-thumbs">
                    {quickGallery.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        className={`shop-gallery-thumb${idx === galleryIdx ? " active" : ""}`}
                        onClick={() => setGalleryIdx(idx)}
                      >
                        <ProductImage
                          src={url}
                          alt={`${quickViewProduct.productName} ${idx + 1}`}
                          size={44}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div className="shop-sold">
                  {quickViewProduct.brand || "Karto"} · {quickViewProduct.category}{" "}
                  · {quickViewProduct.sku}
                </div>
                <div className="shop-card-price-row">
                  <span className="shop-price-now" style={{ fontSize: 22 }}>
                    {formatPHP(quickViewProduct.unitPrice)}
                  </span>
                  <span className="shop-rating">
                    {(quickViewProduct.rating ?? 4.2).toFixed(2)} <Star size={14} />
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: "#374151",
                    lineHeight: 1.55,
                  }}
                >
                  {quickViewProduct.description ||
                    "Available for nationwide 3PL delivery directly from the Karto Online Warehouse."}
                </div>
                <div className="shop-sold">
                  Online Warehouse Stock:{" "}
                  <strong>{quickViewProduct.warehouseStock} unit(s)</strong> ·{" "}
                  Online Sold: {quickViewProduct.unitsSoldOnline}
                </div>
                <button
                  type="button"
                  className="shop-primary-btn"
                  style={{ marginTop: "auto" }}
                  onClick={() => {
                    addToBag(quickViewProduct);
                    setQuickViewSku(null);
                    setDrawerOpen(true);
                  }}
                >
                  Add to Cart &amp; Open Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div
          className="shop-backdrop"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="shop-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag and checkout"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shop-modal-head">
              <h2>
                {receipt ? "Order Confirmed" : `Shopping Bag (${totalBagCount})`}
              </h2>
              <button
                type="button"
                className="shop-icon-close"
                aria-label="Close bag"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="shop-drawer-body">
              {receipt ? (
                <div className="shop-confirmed">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#059669",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    <CheckCircle2 size={20} />
                    Online Order Synced to Karto Hub
                  </div>
                  <div className="shop-confirmed-row">
                    <span>Order Reference</span>
                    <strong>{receipt.referenceIds.join(", ")}</strong>
                  </div>
                  <div className="shop-confirmed-row">
                    <span>Shopper</span>
                    <strong>{receipt.customerName}</strong>
                  </div>
                  <div className="shop-confirmed-row">
                    <span>3PL Courier</span>
                    <strong>
                      {receipt.carrier} · {receipt.trackingNumber}
                    </strong>
                  </div>
                  <div className="shop-confirmed-row">
                    <span>Payment (PCI DSS)</span>
                    <strong>{receipt.maskedCard}</strong>
                  </div>
                  {receipt.discountAmount > 0 && (
                    <div className="shop-confirmed-row">
                      <span>Promo ({receipt.promoCode})</span>
                      <strong>-{formatPHP(receipt.discountAmount)}</strong>
                    </div>
                  )}
                  <div className="shop-confirmed-row">
                    <span>Loyalty Points Earned</span>
                    <strong>+{receipt.pointsEarned} pts</strong>
                  </div>
                  <div
                    className="shop-confirmed-row"
                    style={{
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 8,
                      fontSize: 15,
                    }}
                  >
                    <span>Total Paid</span>
                    <strong>{formatPHP(receipt.totalAmount)}</strong>
                  </div>

                  <Link href="/" className="shop-primary-btn">
                    Open Karto Hub <ArrowRight size={15} />
                  </Link>
                  <button
                    type="button"
                    className="shop-secondary-btn"
                    onClick={() => {
                      setReceipt(null);
                      setDrawerOpen(false);
                    }}
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : bagLines.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 12px", color: "#6b7280" }}>
                  Your bag is empty. Add items from the storefront to place a
                  live online order.
                </div>
              ) : (
                <>
                  {bagLines.map(({ product, quantity }) => (
                    <div key={product.sku} className="shop-bag-item">
                      <ProductImage
                        src={product.thumbnail}
                        alt={product.productName}
                        size={44}
                      />
                      <div className="shop-bag-item-info">
                        <strong>{product.productName}</strong>
                        <span className="shop-sold">
                          {formatPHP(product.unitPrice)} each
                        </span>
                      </div>
                      <div className="shop-qty-ctrl">
                        <button
                          type="button"
                          aria-label={`Decrease quantity for ${product.productName}`}
                          onClick={() => updateBagQty(product.sku, -1)}
                        >
                          −
                        </button>
                        <span>{quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase quantity for ${product.productName}`}
                          onClick={() => updateBagQty(product.sku, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="shop-icon-close"
                        aria-label={`Remove ${product.productName}`}
                        onClick={() =>
                          setBag((prev) =>
                            prev.filter((l) => l.sku !== product.sku),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  <div>
                    <label className="shop-field-label" htmlFor="bag-shopper">
                      Shopper Account (CRM &amp; GDPR)
                    </label>
                    <select
                      id="bag-shopper"
                      className="shop-input"
                      value={activeShopper?.customerId || shopperId}
                      onChange={(e) => setShopperId(e.target.value)}
                    >
                      {shoppers.map((s) => (
                        <option key={s.customerId} value={s.customerId}>
                          {s.fullName} ({s.loyaltyTier} · {s.gdprConsent})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    className={`shop-offer-box${
                      offerPreview.state === "suppressed"
                        ? " is-suppressed"
                        : offerPreview.state === "neutral"
                          ? " is-neutral"
                          : ""
                    }`}
                  >
                    {offerPreview.state === "suppressed" ? (
                      <Lock size={13} style={{ display: "inline", marginRight: 6 }} />
                    ) : (
                      <Tag size={13} style={{ display: "inline", marginRight: 6 }} />
                    )}
                    {offerPreview.note}
                  </div>

                  <div>
                    <span className="shop-field-label">3PL Delivery Courier</span>
                    <div className="shop-pill-grid">
                      {CARRIERS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`shop-choice-pill${carrier === c ? " active" : ""}`}
                          onClick={() => setCarrier(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="shop-field-label">
                      Payment Method (PCI DSS Protected)
                    </span>
                    <div className="shop-pill-grid cols-3">
                      {(["Card", "GCash", "Maya"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`shop-choice-pill${paymentMethod === m ? " active" : ""}`}
                          onClick={() => setPaymentMethod(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    {paymentMethod === "Card" && (
                      <input
                        aria-label="Demo card number"
                        className="shop-input"
                        style={{ marginTop: 8 }}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4532-8910-4421-4242"
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            {!receipt && bagLines.length > 0 && (
              <div className="shop-drawer-foot">
                <div className="shop-total-line">
                  <span>Subtotal</span>
                  <span>{formatPHP(subtotal)}</span>
                </div>
                {offerPreview.discountAmount > 0 && (
                  <div className="shop-total-line" style={{ color: "#059669" }}>
                    <span>Promo ({offerPreview.promoCode})</span>
                    <span>-{formatPHP(offerPreview.discountAmount)}</span>
                  </div>
                )}
                <div className="shop-total-line is-grand">
                  <span>Total</span>
                  <span>{formatPHP(totalDue)}</span>
                </div>
                <button
                  type="button"
                  className="shop-primary-btn"
                  disabled={submitting}
                  onClick={() => void placeOrder()}
                >
                  {submitting ? "Placing Order…" : `Place Order · ${formatPHP(totalDue)}`}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
