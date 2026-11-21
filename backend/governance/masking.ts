import { branchScope, isSpecialist } from "@/shared/access";
import { computeSalesSummary } from "@/backend/etl/pipeline";
import type {
  AccessIdentity,
  CRMRecord,
  InventoryRecord,
  LogisticsRecord,
  OnlineOrderRecord,
  POSRecord,
  SalesSummary,
  UnifiedCustomerRecord,
  UnifiedStockItem,
  UserRole,
} from "@/shared/types";

export function maskPaymentCard(
  raw: string | undefined,
  role: UserRole,
): string {
  if (!raw || raw === "N/A" || raw === "Cash / E-Wallet") {
    return "Cash / E-Wallet";
  }
  const digits = raw.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  if (
    role === "OPS_MANAGER" ||
    role === "BRANCH_MANAGER" ||
    role === "CASHIER"
  ) {
    return last4 ? `•••• •••• •••• ${last4}` : "•••• ••••";
  }
  if (role === "MARKETING_CRM") return "[PCI DSS Restricted]";
  return "[PCI DSS Masked]";
}

function pseudonym(index: number): string {
  return `Customer #${String(index + 1).padStart(2, "0")}`;
}

export function applyRetailGovernance(
  role: UserRole,
  identity: AccessIdentity | undefined,
  data: {
    posRecords: POSRecord[];
    inventoryRecords: InventoryRecord[];
    crmRecords: CRMRecord[];
    onlineRecords: OnlineOrderRecord[];
    logisticsRecords: LogisticsRecord[];
    stockItems: UnifiedStockItem[];
    customers: UnifiedCustomerRecord[];
    salesSummary: SalesSummary;
  },
) {
  const scope = branchScope(role, identity);
  if (isSpecialist(role)) {
    const logisticsRecords =
      role === "DELIVERY_COORDINATOR" ? data.logisticsRecords : [];
    let stockItems: UnifiedStockItem[] = [];
    if (role === "INVENTORY_STAFF") {
      stockItems = data.stockItems.map((item) => ({
        ...item,
        revenueTotal: 0,
      }));
    } else if (role === "CASHIER" && scope) {
      stockItems = data.stockItems.map((item) => {
        const available =
          scope === "Manila" ? item.manilaStock : item.cebuStock;
        return {
          ...item,
          manilaStock: scope === "Manila" ? available : 0,
          cebuStock: scope === "Cebu" ? available : 0,
          warehouseStock: 0,
          totalStock: available,
          unitsSoldPOS: 0,
          unitsSoldOnline: 0,
          revenueTotal: 0,
          stockStatus:
            available < 0
              ? "Oversell Risk"
              : available <= 4
                ? "Low Stock"
                : "Synced",
        };
      });
    }

    return {
      branchScope: scope,
      posRecords: [],
      inventoryRecords: role === "INVENTORY_STAFF" ? data.inventoryRecords : [],
      crmRecords: [],
      onlineRecords: [],
      logisticsRecords,
      stockItems,
      customers: [],
      salesSummary: computeSalesSummary([], [], logisticsRecords, new Map()),
    };
  }

  const invMap = new Map(data.inventoryRecords.map((i) => [i.sku, i]));

  // Pseudonym index map sorted consistently by customerId
  const pseudoOrder = [...data.customers]
    .sort((a, b) => a.customerId.localeCompare(b.customerId))
    .map((c, idx) => [c.customerId, pseudonym(idx)] as const);
  const pseudoMap = new Map(pseudoOrder);

  // Determine branch-scoped customers if Branch Manager
  const branchBuyerIds = new Set(
    scope
      ? [
          ...data.customers
            .filter((c) => c.preferredBranch === scope)
            .map((c) => c.customerId),
          ...data.posRecords
            .filter((p) => p.branch === scope)
            .map((p) => p.customerId),
        ]
      : data.customers.map((c) => c.customerId),
  );

  const scopedPOS = data.posRecords
    .filter((p) => !scope || p.branch === scope)
    .map((p) => ({
      ...p,
      customerId:
        role === "COMPLIANCE_AUDITOR"
          ? pseudoMap.get(p.customerId) || "Walk-In Guest"
          : p.customerId,
      cardNumber: maskPaymentCard(p.cardNumber, role),
    }));

  const scopedOnline = data.onlineRecords
    .filter((o) => !scope || branchBuyerIds.has(o.customerId))
    .map((o) => ({
      ...o,
      customerId:
        role === "COMPLIANCE_AUDITOR"
          ? pseudoMap.get(o.customerId) || o.customerId
          : o.customerId,
      cardNumber: maskPaymentCard(o.cardNumber, role),
    }));

  const scopedLogistics = data.logisticsRecords
    .filter((l) => !scope || branchBuyerIds.has(l.customerId))
    .map((l) => ({
      ...l,
      customerId:
        role === "COMPLIANCE_AUDITOR"
          ? pseudoMap.get(l.customerId) || l.customerId
          : l.customerId,
    }));

  const scopedCRM: CRMRecord[] = data.crmRecords
    .filter((c) => !scope || branchBuyerIds.has(c.customerId))
    .map((c) => {
      if (role === "COMPLIANCE_AUDITOR") {
        return {
          ...c,
          fullName: pseudoMap.get(c.customerId) || c.customerId,
          email: "[GDPR Masked]",
          phone: "[GDPR Masked]",
        };
      }
      if (role === "BRANCH_MANAGER") {
        return {
          ...c,
          email: "[GDPR Masked]",
          phone: "[GDPR Masked]",
        };
      }
      if (role === "MARKETING_CRM" && c.gdprConsent === "Opted Out") {
        return {
          ...c,
          email: "[GDPR Opted Out]",
          phone: "[GDPR Opted Out]",
        };
      }
      return c;
    });

  const scopedCustomers: UnifiedCustomerRecord[] = data.customers
    .filter((c) => !scope || branchBuyerIds.has(c.customerId))
    .map((c) => {
      const maskedPos = c.posTransactions
        .filter((p) => !scope || p.branch === scope)
        .map((p) => ({
          ...p,
          cardNumber: maskPaymentCard(p.cardNumber, role),
        }));
      const maskedOnline = c.onlineOrders
        .filter(() => !scope)
        .map((o) => ({
          ...o,
          cardNumber: maskPaymentCard(o.cardNumber, role),
        }));
      const maskedShipments = scope ? [] : c.shipments;

      let fullName = c.fullName;
      let email = c.email;
      let phone = c.phone;

      if (role === "COMPLIANCE_AUDITOR") {
        fullName = pseudoMap.get(c.customerId) || c.customerId;
        email = "[GDPR Masked]";
        phone = "[GDPR Masked]";
      } else if (role === "BRANCH_MANAGER") {
        email = "[GDPR Masked]";
        phone = "[GDPR Masked]";
      } else if (role === "MARKETING_CRM" && c.gdprConsent === "Opted Out") {
        email = "[GDPR Opted Out]";
        phone = "[GDPR Opted Out]";
      }

      return {
        ...c,
        fullName,
        email,
        phone,
        maskedCardOnFile: maskPaymentCard(c.maskedCardOnFile, role),
        posTransactions: maskedPos,
        onlineOrders: maskedOnline,
        shipments: maskedShipments,
      };
    });

  // For BRANCH_MANAGER, calculate salesSummary for their Manila POS branch only
  const salesSummary = scope
    ? computeSalesSummary(scopedPOS, [], scopedLogistics, invMap)
    : data.salesSummary;

  return {
    branchScope: scope,
    posRecords: scopedPOS,
    inventoryRecords: data.inventoryRecords,
    crmRecords: scopedCRM,
    onlineRecords: scopedOnline,
    logisticsRecords: scopedLogistics,
    stockItems: data.stockItems,
    customers: scopedCustomers,
    salesSummary,
  };
}
