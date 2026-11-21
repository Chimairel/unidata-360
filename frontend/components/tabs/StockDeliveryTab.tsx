"use client";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Globe,
  Plus,
  RotateCcw,
  Search,
  Star,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { useEDM } from "@/frontend/lib/context/EDMContext";
import {
  BRANCHES,
  CARRIERS,
  CATEGORIES,
  formatPHP,
  type Branch,
  type Carrier,
  type ProductCategory,
} from "@/shared/retail";
import type { CatalogProduct, UnifiedStockItem } from "@/shared/types";
import {
  Badge,
  EmptyState,
  Modal,
  PageHeading,
  ProductImage,
  StockStatusBadge,
} from "@/frontend/components/ui";

export function StockDeliveryTab() {
  const {
    currentRole,
    branchScope,
    stockItems,
    inventoryRecords,
    crmRecords,
    logisticsRecords,
    consistencyAlerts,
    salesSummary,
    isSyncing,
    recordPOSSale,
    recordOnlineOrder,
    dispatchOrder,
    updateShipment,
    transferStock,
    simulateSeasonalSpike,
    restockSKU,
    importCatalogProduct,
    resetAllData,
  } = useEDM();

  const isOps = currentRole === "OPS_MANAGER";
  const canPOS =
    currentRole === "OPS_MANAGER" || currentRole === "BRANCH_MANAGER";

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleChannel, setSaleChannel] = useState<"POS" | "ONLINE">("POS");
  const [branch, setBranch] = useState<Branch>(branchScope || "Manila");
  const [sku, setSku] = useState("SKU-101");
  const [customerId, setCustomerId] = useState("CUST-001");
  const [quantity, setQuantity] = useState(1);
  const [carrier, setCarrier] = useState<Carrier>("LBC Express");
  const [paymentMethod, setPaymentMethod] = useState<"Card" | "Cash" | "GCash">(
    "Card",
  );

  const [detailSku, setDetailSku] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSource, setCatalogSource] = useState<"live" | "fallback">(
    "live",
  );
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<
    "ALL" | ProductCategory
  >("ALL");
  const [catalogLimit, setCatalogLimit] = useState(12);

  const [deliveryFilter, setDeliveryFilter] = useState<
    "ALL" | "IN_TRANSIT" | "Delivered" | "Delayed"
  >("ALL");
  const [dispatchCarriers, setDispatchCarriers] = useState<
    Record<string, Carrier>
  >({});
  const [transferFrom, setTransferFrom] = useState<
    "Manila" | "Cebu" | "Online"
  >("Online");
  const [transferTo, setTransferTo] = useState<"Manila" | "Cebu" | "Online">(
    "Manila",
  );
  const [transferQty, setTransferQty] = useState(5);

  const activeSku = stockItems.some((s) => s.sku === sku)
    ? sku
    : stockItems[0]?.sku || "SKU-101";
  const previewSaleItem = stockItems.find((s) => s.sku === activeSku);

  const detailItem: UnifiedStockItem | undefined = detailSku
    ? stockItems.find((s) => s.sku === detailSku)
    : undefined;

  const detailGallery = detailItem
    ? detailItem.images?.length
      ? detailItem.images
      : detailItem.thumbnail
        ? [detailItem.thumbnail]
        : []
    : [];
  const activeDetailPhoto =
    detailGallery[activeImageIdx] || detailItem?.thumbnail;

  const openDetailModal = (item: UnifiedStockItem) => {
    setDetailSku(item.sku);
    setActiveImageIdx(0);
  };

  const openCatalogModal = async () => {
    setCatalogOpen(true);
    setCatalogQuery("");
    setCatalogCategory("ALL");
    setCatalogLimit(12);
    if (catalogProducts.length > 0) return;

    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load catalog.");
      setCatalogProducts(data.products || []);
      setCatalogSource(data.source === "fallback" ? "fallback" : "live");
    } catch (e) {
      setCatalogError(
        e instanceof Error ? e.message : "Failed to load DummyJSON catalog.",
      );
    } finally {
      setCatalogLoading(false);
    }
  };

  const existingByExternalId = new Map<number, UnifiedStockItem>();
  for (const s of stockItems) {
    if (typeof s.externalId === "number") {
      existingByExternalId.set(s.externalId, s);
    }
  }

  const filteredCatalog = catalogProducts.filter((p) => {
    const q = catalogQuery.trim().toLowerCase();
    const matchesQ =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.rawCategory.toLowerCase().includes(q);
    const matchesCat =
      catalogCategory === "ALL" || p.category === catalogCategory;
    return matchesQ && matchesCat;
  });

  const totalUnits = stockItems.reduce((sum, s) => sum + s.totalStock, 0);
  const restockCount = stockItems.filter(
    (s) => s.stockStatus !== "Synced",
  ).length;

  const customerMap = new Map(crmRecords.map((c) => [c.customerId, c.fullName]));
  const missingTrackingAlerts = consistencyAlerts.filter(
    (a) => a.type === "MISSING_TRACKING",
  );

  const filteredShipments = logisticsRecords.filter((s) => {
    if (deliveryFilter === "ALL") return true;
    if (deliveryFilter === "IN_TRANSIT")
      return s.status !== "Delivered" && s.status !== "Delayed";
    return s.status === deliveryFilter;
  });

  return (
    <div className="page-stack">
      <PageHeading
        title={
          branchScope
            ? `${branchScope} Stock & Delivery`
            : "Stock & 3PL Delivery"
        }
        description="Real-time inventory across Manila Store, Cebu Store, and Online Warehouse synced with the live product catalog and 3PL couriers."
        action={
          <>
            {isOps && (
              <button
                type="button"
                className="button secondary"
                disabled={isSyncing}
                onClick={() => void openCatalogModal()}
              >
                <Globe size={15} />
                Add Product
              </button>
            )}
            {canPOS && (
              <button
                type="button"
                className="button secondary"
                disabled={isSyncing}
                onClick={() => {
                  setSaleChannel("POS");
                  setBranch(branchScope || "Manila");
                  setSaleModalOpen(true);
                }}
              >
                <Plus size={15} />
                Custom Sale
              </button>
            )}
            {isOps && (
              <>
                <button
                  type="button"
                  className="button danger-button"
                  disabled={isSyncing}
                  onClick={() => void simulateSeasonalSpike()}
                >
                  <Zap size={15} />
                  11.11 Spike
                </button>
                <button
                  type="button"
                  className="button quiet"
                  disabled={isSyncing}
                  onClick={() => void resetAllData()}
                >
                  <RotateCcw size={15} />
                  Reset Data
                </button>
              </>
            )}
          </>
        }
      />

      <dl className="metric-strip cols-3">
        <div className="metric-cell">
          <dt>Total units in stock</dt>
          <dd>{totalUnits}</dd>
        </div>
        <div className="metric-cell">
          <dt>Products needing restock</dt>
          <dd className={restockCount > 0 ? "text-danger" : ""}>
            {restockCount}
            <span>of {stockItems.length} SKUs</span>
          </dd>
        </div>
        <div className="metric-cell">
          <dt>3PL deliveries on time</dt>
          <dd>
            {salesSummary.onTimeDeliveryRate}%
            <span>{salesSummary.delayedShipments} delayed</span>
          </dd>
        </div>
      </dl>

      <section aria-label="Live product stock cards">
        <div className="section-subhead">
          <h2>Live Product Stock</h2>
          <p>Click any product to inspect photos, pricing, and channel counts</p>
        </div>

        <div className="stock-card-grid">
          {stockItems.map((item) => {
            const urgent = item.stockStatus !== "Synced";
            return (
              <article
                key={item.sku}
                className={`stock-card${item.stockStatus === "Oversell Risk" ? " is-danger" : item.stockStatus === "Low Stock" ? " is-warning" : ""}`}
              >
                <button
                  type="button"
                  className="stock-card-media"
                  aria-label={`Inspect ${item.productName}`}
                  onClick={() => openDetailModal(item)}
                >
                  <ProductImage
                    src={item.thumbnail}
                    alt={item.productName}
                    size={140}
                  />
                </button>

                <div className="stock-card-body">
                  <div className="stock-card-top">
                    <div>
                      <button
                        type="button"
                        className="stock-title-btn"
                        onClick={() => openDetailModal(item)}
                      >
                        {item.productName}
                      </button>
                      <small className="muted">
                        {item.brand ? `${item.brand} · ` : ""}
                        <span className="mono">{item.sku}</span> ·{" "}
                        {formatPHP(item.unitPrice)}
                        {typeof item.rating === "number"
                          ? ` · ★ ${item.rating.toFixed(1)}`
                          : ""}
                      </small>
                    </div>
                    <StockStatusBadge status={item.stockStatus} />
                  </div>

                  <div className="channel-stock-strip">
                    <div>
                      <span>Manila</span>
                      <strong
                        className={item.manilaStock <= 4 ? "text-warning" : ""}
                      >
                        {item.manilaStock}
                      </strong>
                    </div>
                    <div>
                      <span>Cebu</span>
                      <strong
                        className={item.cebuStock <= 4 ? "text-warning" : ""}
                      >
                        {item.cebuStock}
                      </strong>
                    </div>
                    <div>
                      <span>Online</span>
                      <strong
                        className={
                          item.warehouseStock < 0
                            ? "text-danger"
                            : item.warehouseStock <= 4
                              ? "text-warning"
                              : ""
                        }
                      >
                        {item.warehouseStock}
                      </strong>
                    </div>
                  </div>

                  <div className="stock-card-footer">
                    <span>
                      {item.totalStock} on hand ·{" "}
                      {item.unitsSoldPOS + item.unitsSoldOnline} sold
                    </span>
                    {canPOS && (
                      <button
                        type="button"
                        className={`button ${urgent ? "primary" : "quiet"}`}
                        style={{ minHeight: 34, padding: "5px 12px" }}
                        disabled={isSyncing}
                        onClick={() => void restockSKU(item.sku, 20)}
                      >
                        <Plus size={13} />
                        +20 Restock
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>3PL Partner Deliveries</h2>
            <p>
              Shipments tracked across LBC Express, J&amp;T Express, GrabExpress,
              and DHL
            </p>
          </div>
          <div className="feed-tabs" role="tablist" aria-label="Filter deliveries">
            {(["ALL", "IN_TRANSIT", "Delivered", "Delayed"] as const).map(
              (f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={deliveryFilter === f}
                  className={deliveryFilter === f ? "active" : ""}
                  onClick={() => setDeliveryFilter(f)}
                >
                  {f === "ALL" ? "All" : f === "IN_TRANSIT" ? "In Transit" : f}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="hairline-list">
          {missingTrackingAlerts.map((alert) => {
            const selectedCarrier =
              dispatchCarriers[alert.referenceKey] || "LBC Express";
            return (
              <div key={alert.id} className="hairline-list-row">
                <div className="delivery-main">
                  <strong>
                    <AlertTriangle size={14} className="text-warning" /> Order{" "}
                    {alert.referenceKey} awaiting courier pickup
                  </strong>
                  <small>{alert.message}</small>
                </div>
                <div className="shipment-actions">
                  {isOps ? (
                    <div className="shipment-dispatch-inline">
                      <select
                        aria-label={`Select carrier for ${alert.referenceKey}`}
                        value={selectedCarrier}
                        disabled={isSyncing}
                        onChange={(e) =>
                          setDispatchCarriers((prev) => ({
                            ...prev,
                            [alert.referenceKey]: e.target.value as Carrier,
                          }))
                        }
                      >
                        {CARRIERS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ minHeight: 32, padding: "4px 10px" }}
                        disabled={isSyncing}
                        onClick={() =>
                          void dispatchOrder(
                            alert.referenceKey,
                            selectedCarrier,
                          )
                        }
                      >
                        Dispatch 3PL
                      </button>
                    </div>
                  ) : (
                    <Badge tone="warning">Missing 3PL Tracking</Badge>
                  )}
                </div>
              </div>
            );
          })}

          {!filteredShipments.length ? (
            <EmptyState title="No shipments in this filter">
              Switch filter above to view other 3PL partner deliveries.
            </EmptyState>
          ) : (
            filteredShipments.map((s) => (
              <div key={s.shipmentId} className="hairline-list-row">
                <div className="delivery-main">
                  <strong>
                    <Truck size={14} /> {s.carrier} ·{" "}
                    {customerMap.get(s.customerId) || s.customerId}
                  </strong>
                  <small>
                    Order <span className="mono">{s.orderId}</span> · Tracking{" "}
                    <span className="mono">{s.trackingNumber}</span> · ETA{" "}
                    {s.estimatedDelivery}
                  </small>
                  {s.delayReason && (
                    <small className="text-danger">
                      Delay reason: {s.delayReason}
                    </small>
                  )}
                </div>
                <div className="shipment-actions">
                  <Badge
                    tone={
                      s.status === "Delayed"
                        ? "danger"
                        : s.status === "Delivered"
                          ? "success"
                          : s.status === "Out for Delivery"
                            ? "info"
                            : "warning"
                    }
                  >
                    {s.status}
                  </Badge>
                  {isOps && s.status === "Label Created" && (
                    <button
                      type="button"
                      className="button secondary"
                      style={{ minHeight: 30, padding: "4px 10px" }}
                      disabled={isSyncing}
                      onClick={() =>
                        void updateShipment(s.shipmentId, "In Transit")
                      }
                    >
                      Mark In Transit
                    </button>
                  )}
                  {isOps && s.status === "In Transit" && (
                    <>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ minHeight: 30, padding: "4px 10px" }}
                        disabled={isSyncing}
                        onClick={() =>
                          void updateShipment(s.shipmentId, "Out for Delivery")
                        }
                      >
                        Out for Delivery
                      </button>
                      <button
                        type="button"
                        className="button quiet"
                        style={{ minHeight: 30, padding: "4px 10px" }}
                        disabled={isSyncing}
                        onClick={() =>
                          void updateShipment(
                            s.shipmentId,
                            "Delayed",
                            "Hub weather delay",
                          )
                        }
                      >
                        Flag Delay
                      </button>
                    </>
                  )}
                  {isOps && s.status === "Out for Delivery" && (
                    <button
                      type="button"
                      className="button primary"
                      style={{ minHeight: 30, padding: "4px 10px" }}
                      disabled={isSyncing}
                      onClick={() =>
                        void updateShipment(s.shipmentId, "Delivered")
                      }
                    >
                      Mark Delivered
                    </button>
                  )}
                  {isOps && s.status === "Delayed" && (
                    <button
                      type="button"
                      className="button secondary"
                      style={{ minHeight: 30, padding: "4px 10px" }}
                      disabled={isSyncing}
                      onClick={() =>
                        void updateShipment(s.shipmentId, "Out for Delivery")
                      }
                    >
                      Resolve Delay
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {detailItem && (
        <Modal
          title={detailItem.productName}
          wide
          onClose={() => setDetailSku(null)}
        >
          <div className="modal-body product-detail-layout">
            <div className="product-detail-gallery">
              <div className="product-detail-stage">
                <ProductImage
                  src={activeDetailPhoto}
                  alt={detailItem.productName}
                  size={300}
                />
              </div>
              {detailGallery.length > 1 && (
                <div className="product-detail-thumbs">
                  {detailGallery.map((imgUrl, idx) => (
                    <button
                      key={imgUrl}
                      type="button"
                      aria-label={`View image ${idx + 1}`}
                      className={`product-thumb-btn${activeImageIdx === idx ? " is-active" : ""}`}
                      onClick={() => setActiveImageIdx(idx)}
                    >
                      <ProductImage
                        src={imgUrl}
                        alt={`${detailItem.productName} ${idx + 1}`}
                        size={52}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="product-detail-info">
              <div className="product-detail-head">
                <div>
                  <span className="muted small">
                    {detailItem.brand || "Karto"} · {detailItem.category} ·{" "}
                    <span className="mono">{detailItem.sku}</span>
                    {detailItem.externalSku
                      ? ` (${detailItem.externalSku})`
                      : ""}
                  </span>
                  <h3>{detailItem.productName}</h3>
                </div>
                <StockStatusBadge status={detailItem.stockStatus} />
              </div>

              <div className="product-detail-price">
                <strong>{formatPHP(detailItem.unitPrice)}</strong>
                {typeof detailItem.discountPercentage === "number" &&
                  detailItem.discountPercentage > 0 && (
                    <Badge tone="info">
                      {detailItem.discountPercentage.toFixed(0)}% off SRP
                    </Badge>
                  )}
                {typeof detailItem.rating === "number" && (
                  <span className="product-rating">
                    <Star size={14} /> {detailItem.rating.toFixed(2)} / 5
                  </span>
                )}
              </div>

              {detailItem.description && (
                <p className="product-detail-desc">{detailItem.description}</p>
              )}

              <div className="channel-stock-strip">
                <div>
                  <span>Manila POS</span>
                  <strong
                    className={
                      detailItem.manilaStock <= 4 ? "text-warning" : ""
                    }
                  >
                    {detailItem.manilaStock}
                  </strong>
                </div>
                <div>
                  <span>Cebu POS</span>
                  <strong
                    className={detailItem.cebuStock <= 4 ? "text-warning" : ""}
                  >
                    {detailItem.cebuStock}
                  </strong>
                </div>
                <div>
                  <span>Online Hub</span>
                  <strong
                    className={
                      detailItem.warehouseStock < 0
                        ? "text-danger"
                        : detailItem.warehouseStock <= 4
                          ? "text-warning"
                          : ""
                    }
                  >
                    {detailItem.warehouseStock}
                  </strong>
                </div>
              </div>

              <div className="stock-card-footer">
                <span>
                  {detailItem.unitsSoldPOS + detailItem.unitsSoldOnline} units
                  sold · {formatPHP(detailItem.revenueTotal)} total revenue
                </span>
              </div>

              {isOps && (
                <div className="transfer-strip">
                  <strong>
                    <ArrowLeftRight size={13} /> Transfer Stock Between Channels
                  </strong>
                  <div className="transfer-controls">
                    <select
                      aria-label="Source channel"
                      value={transferFrom}
                      disabled={isSyncing}
                      onChange={(e) => {
                        const nextFrom = e.target.value as
                          | "Manila"
                          | "Cebu"
                          | "Online";
                        if (nextFrom === transferTo) {
                          setTransferTo(transferFrom);
                        }
                        setTransferFrom(nextFrom);
                      }}
                    >
                      <option value="Online">Online Hub</option>
                      <option value="Manila">Manila POS</option>
                      <option value="Cebu">Cebu POS</option>
                    </select>
                    <span className="muted">→</span>
                    <select
                      aria-label="Destination channel"
                      value={transferTo}
                      disabled={isSyncing}
                      onChange={(e) => {
                        const nextTo = e.target.value as
                          | "Manila"
                          | "Cebu"
                          | "Online";
                        if (nextTo === transferFrom) {
                          setTransferFrom(transferTo);
                        }
                        setTransferTo(nextTo);
                      }}
                    >
                      <option value="Manila">Manila POS</option>
                      <option value="Cebu">Cebu POS</option>
                      <option value="Online">Online Hub</option>
                    </select>
                    <input
                      aria-label="Transfer quantity"
                      type="number"
                      min={1}
                      max={200}
                      value={transferQty}
                      disabled={isSyncing}
                      onChange={(e) =>
                        setTransferQty(Math.max(1, Number(e.target.value) || 1))
                      }
                    />
                    <button
                      type="button"
                      className="button secondary"
                      style={{ minHeight: 34, padding: "5px 12px" }}
                      disabled={isSyncing || transferFrom === transferTo}
                      onClick={() =>
                        void transferStock({
                          sku: detailItem.sku,
                          fromChannel: transferFrom,
                          toChannel: transferTo,
                          quantity: transferQty,
                        })
                      }
                    >
                      Transfer
                    </button>
                  </div>
                </div>
              )}

              {canPOS && (
                <div className="form-actions" style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={isSyncing}
                    onClick={() => {
                      setSku(detailItem.sku);
                      setDetailSku(null);
                      setSaleChannel("POS");
                      setBranch(branchScope || "Manila");
                      setSaleModalOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    Record Sale
                  </button>
                  <button
                    type="button"
                    className={`button ${detailItem.stockStatus !== "Synced" ? "primary" : "secondary"}`}
                    disabled={isSyncing}
                    onClick={() => void restockSKU(detailItem.sku, 20)}
                  >
                    <Plus size={14} />
                    +20 Restock
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {catalogOpen && (
        <Modal
          title="Product Catalog"
          wide
          onClose={() => setCatalogOpen(false)}
        >
          <div className="modal-body catalog-modal-body">
            <div className="catalog-toolbar">
              <div className="search-field">
                <Search size={16} />
                <input
                  aria-label="Search product catalog"
                  placeholder="Search fragrances, beauty, shoes, tech…"
                  value={catalogQuery}
                  onChange={(e) => {
                    setCatalogQuery(e.target.value);
                    setCatalogLimit(12);
                  }}
                />
                {catalogQuery && (
                  <button
                    type="button"
                    className="search-clear"
                    aria-label="Clear catalog search"
                    onClick={() => setCatalogQuery("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                aria-label="Filter catalog category"
                className="catalog-category-select"
                value={catalogCategory}
                onChange={(e) => {
                  setCatalogCategory(e.target.value as "ALL" | ProductCategory);
                  setCatalogLimit(12);
                }}
              >
                <option value="ALL">All categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <Badge tone={catalogSource === "live" ? "success" : "warning"}>
                {catalogSource === "live"
                  ? `Live Catalog · ${catalogProducts.length} items`
                  : `Offline Catalog · ${catalogProducts.length} items`}
              </Badge>
            </div>

            {catalogLoading ? (
              <EmptyState title="Connecting to DummyJSON Products API…">
                Fetching 7-Evelyn catalog metadata and product photos.
              </EmptyState>
            ) : catalogError ? (
              <EmptyState title="Could not load catalog">{catalogError}</EmptyState>
            ) : !filteredCatalog.length ? (
              <EmptyState title="No matching products">
                Try another search term or switch the category filter.
              </EmptyState>
            ) : (
              <>
                <div className="catalog-grid">
                  {filteredCatalog.slice(0, catalogLimit).map((p) => {
                    const existing = existingByExternalId.get(p.id);
                    return (
                      <article key={p.id} className="catalog-item">
                        <div className="catalog-item-media">
                          <ProductImage
                            src={p.thumbnail}
                            alt={p.title}
                            size={104}
                          />
                        </div>
                        <div className="catalog-item-body">
                          <strong>{p.title}</strong>
                          <small className="muted">
                            {p.brand} · {p.category} · ★ {p.rating.toFixed(1)}
                          </small>
                          <div className="catalog-item-meta">
                            <span>{formatPHP(p.unitPricePhp)}</span>
                            <small className="muted">API stock {p.stock}</small>
                          </div>
                          <button
                            type="button"
                            className={`button ${existing ? "quiet" : "secondary"}`}
                            style={{ width: "100%", minHeight: 34 }}
                            disabled={isSyncing}
                            onClick={() => void importCatalogProduct(p.id)}
                          >
                            {existing ? (
                              <>Synced ({existing.sku}) · +Restock</>
                            ) : (
                              <>
                                <Plus size={14} />
                                Add to Store
                              </>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {filteredCatalog.length > catalogLimit && (
                  <div className="catalog-more">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setCatalogLimit((n) => n + 12)}
                    >
                      Show more ({filteredCatalog.length - catalogLimit}{" "}
                      remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {saleModalOpen && (
        <Modal
          title="Record Custom Store or Online Sale"
          onClose={() => setSaleModalOpen(false)}
        >
          <form
            className="modal-body"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok =
                saleChannel === "POS"
                  ? await recordPOSSale({
                      branch: branchScope || branch,
                      sku: activeSku,
                      customerId,
                      quantity,
                      paymentMethod,
                    })
                  : await recordOnlineOrder({
                      sku: activeSku,
                      customerId,
                      quantity,
                      carrier,
                      paymentMethod:
                        paymentMethod === "Cash" ? "Maya" : paymentMethod,
                    });
              if (ok) setSaleModalOpen(false);
            }}
          >
            {previewSaleItem && (
              <div className="sale-product-preview">
                <div className="product-thumb-inline">
                  <ProductImage
                    src={previewSaleItem.thumbnail}
                    alt={previewSaleItem.productName}
                    size={44}
                  />
                </div>
                <div>
                  <strong>{previewSaleItem.productName}</strong>
                  <small className="muted">
                    {formatPHP(previewSaleItem.unitPrice)} · Manila{" "}
                    {previewSaleItem.manilaStock} / Cebu{" "}
                    {previewSaleItem.cebuStock} / Online{" "}
                    {previewSaleItem.warehouseStock}
                  </small>
                </div>
              </div>
            )}

            <div className="form-grid">
              {isOps && (
                <label>
                  Channel
                  <select
                    value={saleChannel}
                    onChange={(e) =>
                      setSaleChannel(e.target.value as "POS" | "ONLINE")
                    }
                  >
                    <option value="POS">In-Store POS</option>
                    <option value="ONLINE">Online Storefront + 3PL</option>
                  </select>
                </label>
              )}

              {saleChannel === "POS" ? (
                <label>
                  POS Branch
                  <select
                    value={branchScope || branch}
                    disabled={Boolean(branchScope)}
                    onChange={(e) => setBranch(e.target.value as Branch)}
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b} POS
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  3PL Courier
                  <select
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value as Carrier)}
                  >
                    {CARRIERS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Product
                <select
                  value={activeSku}
                  onChange={(e) => setSku(e.target.value)}
                >
                  {inventoryRecords.map((item) => (
                    <option key={item.sku} value={item.sku}>
                      {item.productName} ({formatPHP(item.unitPrice)})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Customer
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  {crmRecords.map((c) => (
                    <option key={c.customerId} value={c.customerId}>
                      {c.fullName} ({c.customerId})
                    </option>
                  ))}
                  {saleChannel === "POS" && (
                    <option value="WALKIN-01">Walk-In Guest</option>
                  )}
                </select>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </label>

              <label>
                Payment
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(
                      e.target.value as "Card" | "Cash" | "GCash",
                    )
                  }
                >
                  <option value="Card">Credit / Debit Card</option>
                  <option value="GCash">GCash</option>
                  <option value="Cash">
                    {saleChannel === "ONLINE" ? "Maya" : "Cash"}
                  </option>
                </select>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setSaleModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="button primary" disabled={isSyncing}>
                {saleChannel === "POS" ? "Sync POS Sale" : "Place Online Order"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
