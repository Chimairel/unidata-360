import { randomUUID } from "node:crypto";
import { CARRIERS, CATEGORIES, type ProductCategory } from "@/shared/retail";
import type {
  CRMRecord,
  ConsistencyAlert,
  ETLRunReport,
  InventoryRecord,
  LogisticsRecord,
  OnlineOrderRecord,
  POSRecord,
  PersonalizedOffer,
  SalesSummary,
  UnifiedCustomerRecord,
  UnifiedStockItem,
} from "@/shared/types";

function cleanName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w+/g, (word) =>
      word === word.toUpperCase() && word.length <= 4
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    );
}

function buildPersonalizedOffer(customer: CRMRecord): PersonalizedOffer {
  const category = customer.favoriteCategory;
  if (customer.gdprConsent === "Opted Out") {
    return {
      offerCode: "SUPPRESSED",
      title: "Personalized offer suppressed",
      discountLabel: "Blocked by GDPR Opt-Out",
      targetCategory: category,
      status: "Suppressed (GDPR Opt-Out)",
      reason:
        "GDPR consent is Opted Out — automated profiling & promotional targeting disabled.",
    };
  }
  const tag = category.split(" ")[0].toUpperCase().slice(0, 4);
  if (customer.loyaltyTier === "VIP") {
    return {
      offerCode: `VIP-${tag}20`,
      title: `VIP Priority · 20% Off ${category}`,
      discountLabel: "20% OFF + Free Express",
      targetCategory: category,
      status: "Active",
      reason: `Matched ${customer.loyaltyTier} tier (${customer.pointsBalance.toLocaleString()} pts) with ${category} affinity.`,
    };
  }
  if (customer.loyaltyTier === "Gold") {
    return {
      offerCode: `GOLD-${tag}15`,
      title: `Gold Exclusive · 15% Off ${category}`,
      discountLabel: "15% OFF",
      targetCategory: category,
      status: "Active",
      reason: `Triggered for Opted-In Gold member favoring ${category}.`,
    };
  }
  if (customer.loyaltyTier === "Silver") {
    return {
      offerCode: `SILV-${tag}10`,
      title: `Silver Reward · 10% Off ${category}`,
      discountLabel: "10% OFF",
      targetCategory: category,
      status: "Active",
      reason: `Triggered for Opted-In Silver member favoring ${category}.`,
    };
  }
  return {
    offerCode: "KARTO-SHIP",
    title: `Free Same-Day / 3PL Delivery on ${category}`,
    discountLabel: "FREE SHIPPING",
    targetCategory: category,
    status: "Active",
    reason: `Onboarding reward for Opted-In Bronze shopper in ${customer.preferredBranch}.`,
  };
}

export function computeSalesSummary(
  pos: POSRecord[],
  online: OnlineOrderRecord[],
  logistics: LogisticsRecord[],
  inventoryMap: Map<string, InventoryRecord>,
): SalesSummary {
  let posManilaRevenue = 0;
  let posCebuRevenue = 0;
  let onlineRevenue = 0;

  const categoryTotals = new Map<
    ProductCategory,
    { revenue: number; units: number }
  >(CATEGORIES.map((c) => [c, { revenue: 0, units: 0 }]));

  for (const tx of pos) {
    if (tx.branch === "Manila") posManilaRevenue += tx.totalAmount;
    else posCebuRevenue += tx.totalAmount;
    const cat = inventoryMap.get(tx.sku)?.category || CATEGORIES[0];
    const entry = categoryTotals.get(cat) || { revenue: 0, units: 0 };
    entry.revenue += tx.totalAmount;
    entry.units += tx.quantity;
    categoryTotals.set(cat, entry);
  }

  for (const ord of online) {
    onlineRevenue += ord.totalAmount;
    const cat = inventoryMap.get(ord.sku)?.category || CATEGORIES[0];
    const entry = categoryTotals.get(cat) || { revenue: 0, units: 0 };
    entry.revenue += ord.totalAmount;
    entry.units += ord.quantity;
    categoryTotals.set(cat, entry);
  }

  const totalRevenue = posManilaRevenue + posCebuRevenue + onlineRevenue;
  const totalOrders = pos.length + online.length;
  const averageOrderValue = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;

  const delayedShipments = logistics.filter((s) => s.status === "Delayed").length;
  const onTimeDeliveryRate = logistics.length
    ? Math.round(((logistics.length - delayedShipments) / logistics.length) * 100)
    : 100;

  const carrierPerformance = CARRIERS.map((carrier) => {
    const rows = logistics.filter((l) => l.carrier === carrier);
    const delayed = rows.filter((l) => l.status === "Delayed").length;
    return {
      carrier,
      total: rows.length,
      deliveredOrOnTrack: rows.length - delayed,
      delayed,
    };
  });

  return {
    totalRevenue,
    posManilaRevenue,
    posCebuRevenue,
    onlineRevenue,
    totalOrders,
    averageOrderValue,
    onTimeDeliveryRate,
    delayedShipments,
    revenueByCategory: CATEGORIES.map((category) => ({
      category,
      revenue: categoryTotals.get(category)?.revenue || 0,
      units: categoryTotals.get(category)?.units || 0,
    })),
    carrierPerformance,
  };
}

export function runRetailIntegration(
  posInput: POSRecord[],
  inventoryInput: InventoryRecord[],
  crmInput: CRMRecord[],
  onlineInput: OnlineOrderRecord[],
  logisticsInput: LogisticsRecord[],
) {
  const startTime = new Date().toISOString();
  const now = startTime;

  const inventory = inventoryInput.map((item) => ({
    ...item,
    sku: item.sku.trim().toUpperCase(),
    productName: item.productName.trim(),
  }));
  const inventoryMap = new Map(inventory.map((i) => [i.sku, i]));

  const crm = crmInput.map((c) => ({
    ...c,
    customerId: c.customerId.trim().toUpperCase(),
    fullName: cleanName(c.fullName),
    email: c.email.trim().toLowerCase(),
  }));
  const crmMap = new Map(crm.map((c) => [c.customerId, c]));

  const pos = posInput.map((p) => ({
    ...p,
    txId: p.txId.trim().toUpperCase(),
    customerId: p.customerId.trim().toUpperCase(),
    sku: p.sku.trim().toUpperCase(),
  }));

  const online = onlineInput.map((o) => ({
    ...o,
    orderId: o.orderId.trim().toUpperCase(),
    customerId: o.customerId.trim().toUpperCase(),
    sku: o.sku.trim().toUpperCase(),
  }));

  const logistics = logisticsInput.map((l) => ({
    ...l,
    shipmentId: l.shipmentId.trim().toUpperCase(),
    orderId: l.orderId.trim().toUpperCase(),
    customerId: l.customerId.trim().toUpperCase(),
    trackingNumber: l.trackingNumber.trim().toUpperCase(),
  }));

  const alerts: ConsistencyAlert[] = [];

  // 1. Real-Time Cross-Channel Stock Sync
  const stockItems: UnifiedStockItem[] = inventory.map((item) => {
    const posRows = pos.filter((p) => p.sku === item.sku);
    const onlineRows = online.filter((o) => o.sku === item.sku);
    const unitsSoldPOS = posRows.reduce((s, r) => s + r.quantity, 0);
    const unitsSoldOnline = onlineRows.reduce((s, r) => s + r.quantity, 0);
    const revenueTotal =
      posRows.reduce((s, r) => s + r.totalAmount, 0) +
      onlineRows.reduce((s, r) => s + r.totalAmount, 0);
    const totalStock = item.manilaStock + item.cebuStock + item.warehouseStock;

    let stockStatus: UnifiedStockItem["stockStatus"] = "Synced";
    if (
      item.manilaStock < 0 ||
      item.cebuStock < 0 ||
      item.warehouseStock < 0 ||
      totalStock <= 0
    ) {
      stockStatus = "Oversell Risk";
      alerts.push({
        id: `ALT-OVER-${item.sku}`,
        type: "CHANNEL_OVERSELL",
        severity: "Critical",
        feed: "INVENTORY",
        referenceKey: item.sku,
        message: `${item.sku} (${item.productName}) has negative or zero channel stock (Manila ${item.manilaStock}, Cebu ${item.cebuStock}, Online ${item.warehouseStock}). Restock immediately.`,
        detectedAt: now,
      });
    } else if (
      item.manilaStock <= 4 ||
      item.cebuStock <= 4 ||
      item.warehouseStock <= 4 ||
      totalStock <= item.reorderPoint
    ) {
      stockStatus = "Low Stock";
      alerts.push({
        id: `ALT-LOW-${item.sku}`,
        type: "LOW_STOCK",
        severity: "Warning",
        feed: "INVENTORY",
        referenceKey: item.sku,
        message: `${item.sku} (${item.productName}) is at low buffer (Manila ${item.manilaStock}, Cebu ${item.cebuStock}, Online ${item.warehouseStock}).`,
        detectedAt: now,
      });
    }

    return {
      ...item,
      totalStock,
      unitsSoldPOS,
      unitsSoldOnline,
      revenueTotal,
      stockStatus,
    };
  });

  // 2. Virtualized Customer 360 + Personalized Offer Output
  const customers: UnifiedCustomerRecord[] = crm.map((member) => {
    const posTransactions = pos
      .filter((p) => p.customerId === member.customerId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const onlineOrders = online
      .filter((o) => o.customerId === member.customerId)
      .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
    const orderIds = new Set(onlineOrders.map((o) => o.orderId));
    const shipments = logistics
      .filter(
        (l) => l.customerId === member.customerId || orderIds.has(l.orderId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const posSpend = posTransactions.reduce((s, r) => s + r.totalAmount, 0);
    const onlineSpend = onlineOrders.reduce((s, r) => s + r.totalAmount, 0);
    const totalSpend = posSpend + onlineSpend;

    const latestCard =
      onlineOrders.find((o) => o.cardNumber && o.cardNumber !== "N/A")
        ?.cardNumber ||
      posTransactions.find((p) => p.cardNumber && p.cardNumber !== "N/A")
        ?.cardNumber ||
      "N/A";

    const timestamps = [
      ...posTransactions.map((p) => p.timestamp),
      ...onlineOrders.map((o) => o.orderedAt),
    ].sort((a, b) => b.localeCompare(a));

    return {
      customerId: member.customerId,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      loyaltyTier: member.loyaltyTier,
      pointsBalance: member.pointsBalance,
      preferredBranch: member.preferredBranch,
      gdprConsent: member.gdprConsent,
      favoriteCategory: member.favoriteCategory,
      posSpend,
      onlineSpend,
      totalSpend,
      posOrderCount: posTransactions.length,
      onlineOrderCount: onlineOrders.length,
      lastPurchaseAt: timestamps[0] || member.joinedAt,
      maskedCardOnFile: latestCard,
      personalizedOffer: buildPersonalizedOffer(member),
      posTransactions,
      onlineOrders,
      shipments,
    };
  });

  // 3. Cross-Channel Data Consistency Checks (3PL & Unlinked POS)
  const shippedOrders = new Set(logistics.map((l) => l.orderId));
  for (const shipment of logistics) {
    if (shipment.status === "Delayed") {
      alerts.push({
        id: `ALT-3PL-${shipment.shipmentId}`,
        type: "DELAYED_3PL",
        severity: "Warning",
        feed: "LOGISTICS",
        referenceKey: shipment.shipmentId,
        message: `${shipment.carrier} (${shipment.trackingNumber}) for ${shipment.orderId} is Delayed${shipment.delayReason ? `: ${shipment.delayReason}` : "."}`,
        detectedAt: now,
      });
    }
  }

  for (const ord of online) {
    if (!shippedOrders.has(ord.orderId)) {
      alerts.push({
        id: `ALT-TRACK-${ord.orderId}`,
        type: "MISSING_TRACKING",
        severity: "Warning",
        feed: "ONLINE",
        referenceKey: ord.orderId,
        message: `Online order ${ord.orderId} (${ord.productName}) is ${ord.orderStatus} with no assigned 3PL shipment record.`,
        detectedAt: now,
      });
    }
  }

  for (const tx of pos) {
    if (!crmMap.has(tx.customerId)) {
      alerts.push({
        id: `ALT-POS-${tx.txId}`,
        type: "UNLINKED_POS_CUSTOMER",
        severity: "Warning",
        feed: "POS",
        referenceKey: tx.txId,
        message: `${tx.branch} POS sale ${tx.txId} (${tx.customerId}) is not linked to a registered CRM profile.`,
        detectedAt: now,
      });
    }
  }

  const salesSummary = computeSalesSummary(
    pos,
    online,
    logistics,
    inventoryMap,
  );
  const endTime = new Date().toISOString();
  const report: ETLRunReport = {
    id: `SYNC-${randomUUID().slice(0, 8)}`,
    startTime,
    endTime,
    status: alerts.some((a) => a.severity === "Critical")
      ? "PARTIAL_SUCCESS"
      : "SUCCESS",
    recordsExtracted: {
      POS: pos.length,
      INVENTORY: inventory.length,
      CRM: crm.length,
      ONLINE: online.length,
      LOGISTICS: logistics.length,
    },
    recordsLoaded: stockItems.length + customers.length,
    anomaliesDetected: alerts.length,
    warnings: alerts.slice(0, 6).map((a) => a.message),
  };

  return {
    stockItems,
    customers,
    consistencyAlerts: alerts,
    salesSummary,
    report,
  };
}
