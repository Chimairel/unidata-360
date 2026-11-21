import { formatPHP } from "@/shared/retail";
import type { ConsistencyAlert, Feed, RetailSnapshot } from "@/shared/types";

export const qualityFeeds = {
  POS: "Point of Sale",
  INVENTORY: "Inventory",
  CRM: "Customer records",
  ONLINE: "Online orders",
  LOGISTICS: "Logistics",
} satisfies Record<Feed, string>;

export type QualityStatus = "critical" | "warning" | "clear";
type QualityIssue = {
  label: string;
  dimension: string;
  explanation: string;
  field?: string;
  severity: Exclude<QualityStatus, "clear">;
};
type QualityDraft = {
  feed: Feed;
  reference: string;
  name: string;
  summary: string;
  fields: Record<string, string | number>;
  issues?: QualityIssue[];
};
export type QualityRow = Omit<QualityDraft, "issues"> & {
  key: string;
  status: QualityStatus;
  issues: QualityIssue[];
};
type QualitySources = Pick<
  RetailSnapshot,
  | "posRecords"
  | "inventoryRecords"
  | "crmRecords"
  | "onlineRecords"
  | "logisticsRecords"
  | "consistencyAlerts"
>;

const alertDetails = {
  CHANNEL_OVERSELL: { label: "Oversell risk", dimension: "Stock monitoring" },
  LOW_STOCK: { label: "Low stock", dimension: "Stock monitoring" },
  DELAYED_3PL: {
    label: "Delivery delayed",
    dimension: "Delivery monitoring",
    field: "Delivery status",
  },
  MISSING_TRACKING: {
    label: "Shipment missing",
    dimension: "Completeness",
    field: "Shipment record",
  },
  UNLINKED_POS_CUSTOMER: {
    label: "Customer link missing",
    dimension: "Consistency",
    field: "Customer",
  },
} satisfies Record<
  ConsistencyAlert["type"],
  Pick<QualityIssue, "label" | "dimension" | "field">
>;

const statusOrder = { critical: 0, warning: 1, clear: 2 };

function normalized(value: string) {
  return value.trim().toUpperCase();
}

function recordKey(feed: Feed, reference: string) {
  return `${feed}:${normalized(reference)}`;
}

function saleIssues(quantity: number, total: number, productKnown: boolean) {
  const issues: QualityIssue[] = [];
  if (!Number.isInteger(quantity) || quantity < 1) {
    issues.push({
      label: "Invalid quantity",
      dimension: "Validity",
      field: "Quantity",
      explanation: "A sale needs a whole number of units greater than zero.",
      severity: "critical",
    });
  }
  if (!Number.isFinite(total) || total < 0) {
    issues.push({
      label: "Invalid sale total",
      dimension: "Validity",
      field: "Total",
      explanation: "A sale total must be a finite value of zero or more.",
      severity: "critical",
    });
  }
  if (!productKnown) {
    issues.push({
      label: "Product link missing",
      dimension: "Consistency",
      field: "Product code",
      explanation:
        "The product code on this sale has no corresponding inventory record.",
      severity: "warning",
    });
  }
  return issues;
}

export function buildQualityRows({
  posRecords,
  inventoryRecords,
  crmRecords,
  onlineRecords,
  logisticsRecords,
  consistencyAlerts,
}: QualitySources): QualityRow[] {
  const productCodes = new Set(
    inventoryRecords.map((record) => normalized(record.sku)),
  );
  const onlineOrders = new Map(
    onlineRecords.map((record) => [normalized(record.orderId), record]),
  );
  const linkedOrders = new Set(
    logisticsRecords.map((record) => normalized(record.orderId)),
  );
  const drafts: QualityDraft[] = [
    ...posRecords.map((record): QualityDraft => ({
      feed: "POS",
      reference: record.txId,
      name: record.productName,
      summary: `${record.branch} · Qty ${record.quantity} · ${formatPHP(record.totalAmount)}`,
      fields: {
        Branch: record.branch,
        Customer: record.customerId,
        "Product code": record.sku,
        Quantity: record.quantity,
        "Unit price": formatPHP(record.unitPrice),
        Total: formatPHP(record.totalAmount),
        Payment: record.paymentMethod,
        Recorded: record.timestamp,
      },
      issues: saleIssues(
        record.quantity,
        record.totalAmount,
        productCodes.has(normalized(record.sku)),
      ),
    })),
    ...inventoryRecords.map((record): QualityDraft => ({
      feed: "INVENTORY",
      reference: record.sku,
      name: record.productName,
      summary: `Manila ${record.manilaStock} · Cebu ${record.cebuStock} · Online ${record.warehouseStock}`,
      fields: {
        Category: record.category,
        Manila: record.manilaStock,
        Cebu: record.cebuStock,
        "Online warehouse": record.warehouseStock,
        "Reorder point": record.reorderPoint,
        "Unit price": formatPHP(record.unitPrice),
        Updated: record.lastUpdated,
      },
    })),
    ...crmRecords.map((record): QualityDraft => ({
      feed: "CRM",
      reference: record.customerId,
      name: record.fullName,
      summary: `${record.loyaltyTier} · ${record.preferredBranch} · ${record.gdprConsent}`,
      fields: {
        "Customer name": record.fullName,
        "Loyalty tier": record.loyaltyTier,
        Points: record.pointsBalance,
        "Preferred branch": record.preferredBranch,
        "Marketing consent": record.gdprConsent,
        "Favorite category": record.favoriteCategory,
        Joined: record.joinedAt,
      },
      issues: record.fullName.trim()
        ? []
        : [
            {
              label: "Customer name missing",
              dimension: "Completeness",
              field: "Customer name",
              explanation: "The customer profile is missing a name.",
              severity: "critical",
            },
          ],
    })),
    ...onlineRecords.map((record): QualityDraft => ({
      feed: "ONLINE",
      reference: record.orderId,
      name: record.productName,
      summary: `${record.orderStatus} · Qty ${record.quantity} · ${formatPHP(record.totalAmount)}`,
      fields: {
        Customer: record.customerId,
        "Product code": record.sku,
        Quantity: record.quantity,
        Total: formatPHP(record.totalAmount),
        Payment: record.paymentMethod,
        Promotion: record.promoCode,
        "Order status": record.orderStatus,
        "Shipment record": linkedOrders.has(normalized(record.orderId))
          ? "Linked"
          : "Missing",
        Ordered: record.orderedAt,
      },
      issues: saleIssues(
        record.quantity,
        record.totalAmount,
        productCodes.has(normalized(record.sku)),
      ),
    })),
    ...logisticsRecords.map((record): QualityDraft => {
      const order = onlineOrders.get(normalized(record.orderId));
      const issues: QualityIssue[] = [];
      if (!record.trackingNumber.trim())
        issues.push({
          label: "Tracking number missing",
          dimension: "Completeness",
          field: "Tracking",
          explanation: "The shipment record has no tracking number.",
          severity: "critical",
        });
      if (
        !order ||
        normalized(order.customerId) !== normalized(record.customerId)
      ) {
        issues.push({
          label: order ? "Customers differ" : "Order link missing",
          dimension: "Consistency",
          field: order ? "Customer" : "Order",
          explanation: order
            ? "The shipment and its linked order have different customer identifiers."
            : "The shipment has no corresponding order in the online feed.",
          severity: "warning",
        });
      }
      return {
        feed: "LOGISTICS",
        reference: record.shipmentId,
        name: record.carrier,
        summary: `${record.status} · ${record.orderId}`,
        fields: {
          Order: record.orderId,
          Customer: record.customerId,
          Tracking: record.trackingNumber,
          "Delivery status": record.status,
          "Estimated delivery": record.estimatedDelivery,
          ...(record.delayReason ? { "Delay reason": record.delayReason } : {}),
          Updated: record.updatedAt,
        },
        issues,
      };
    }),
  ];

  const alerts = new Map<string, ConsistencyAlert[]>();
  for (const alert of consistencyAlerts) {
    const key = recordKey(alert.feed, alert.referenceKey);
    const group = alerts.get(key) ?? [];
    group.push(alert);
    alerts.set(key, group);
  }

  return drafts
    .map((draft): QualityRow => {
      const key = recordKey(draft.feed, draft.reference);
      const issues = [...(draft.issues ?? [])];
      for (const alert of alerts.get(key) ?? []) {
        if (
          alert.type === "UNLINKED_POS_CUSTOMER" &&
          draft.fields.Customer === "WALKIN-01"
        )
          continue;
        issues.push({
          ...alertDetails[alert.type],
          explanation: alert.message,
          severity: alert.severity === "Critical" ? "critical" : "warning",
        });
      }
      const status = issues.some((issue) => issue.severity === "critical")
        ? "critical"
        : issues.length
          ? "warning"
          : "clear";
      return { ...draft, key, status, issues };
    })
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}
