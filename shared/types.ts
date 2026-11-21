import type {
  Branch,
  Carrier,
  ProductCategory,
  RetailRole,
} from "./retail";

export type UserRole = RetailRole;

export type Feed = "POS" | "INVENTORY" | "CRM" | "ONLINE" | "LOGISTICS";

// 1. DATA SOURCE: Point of Sale (Manila & Cebu branches)
export interface POSRecord {
  txId: string;
  branch: Branch;
  customerId: string; // e.g. CUST-001 or WALKIN-01
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: "Card" | "Cash" | "GCash";
  cardNumber: string; // Tokenized / masked by server before leaving API
  timestamp: string;
}

// 2. DATA SOURCE: Inventory Management (Branch + Warehouse stock)
export interface InventoryRecord {
  sku: string;
  productName: string;
  category: ProductCategory;
  unitPrice: number;
  manilaStock: number;
  cebuStock: number;
  warehouseStock: number;
  reorderPoint: number;
  lastUpdated: string;
  externalId?: number;
  externalSku?: string;
  brand?: string;
  rating?: number;
  discountPercentage?: number;
  description?: string;
  thumbnail?: string;
  images?: string[];
}

// 3. DATA SOURCE: Customer Relationship Management (CRM)
export interface CRMRecord {
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  loyaltyTier: "VIP" | "Gold" | "Silver" | "Bronze";
  pointsBalance: number;
  preferredBranch: Branch;
  gdprConsent: "Opted In" | "Opted Out";
  favoriteCategory: ProductCategory;
  joinedAt: string;
}

// 4. DATA SOURCE: Public Storefront Website
export interface OnlineOrderRecord {
  orderId: string;
  customerId: string;
  sku: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: "Card" | "GCash" | "Maya";
  cardNumber: string; // Tokenized / masked by server before leaving API
  promoCode: string;
  orderStatus: "Processing" | "Shipped" | "Delivered";
  orderedAt: string;
}

// 5. DATA SOURCE: Third-Party Logistics (3PL Providers)
export interface LogisticsRecord {
  shipmentId: string;
  orderId: string;
  customerId: string;
  carrier: Carrier;
  trackingNumber: string;
  status:
    | "Label Created"
    | "In Transit"
    | "Out for Delivery"
    | "Delivered"
    | "Delayed";
  estimatedDelivery: string;
  delayReason?: string;
  updatedAt: string;
}

// OUTPUT 1: Real-Time Stock Sync Master View
export interface UnifiedStockItem {
  sku: string;
  productName: string;
  category: ProductCategory;
  unitPrice: number;
  manilaStock: number;
  cebuStock: number;
  warehouseStock: number;
  totalStock: number;
  reorderPoint: number;
  unitsSoldPOS: number;
  unitsSoldOnline: number;
  revenueTotal: number;
  stockStatus: "Synced" | "Low Stock" | "Oversell Risk";
  lastUpdated: string;
  externalId?: number;
  externalSku?: string;
  brand?: string;
  rating?: number;
  discountPercentage?: number;
  description?: string;
  thumbnail?: string;
  images?: string[];
}

export interface CatalogProduct {
  id: number;
  sku: string;
  title: string;
  brand: string;
  rawCategory: string;
  category: ProductCategory;
  priceUsd: number;
  unitPricePhp: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  description: string;
  thumbnail: string;
  images: string[];
}

// OUTPUT 2: Personalized Customer Offer (GDPR-aware)
export interface PersonalizedOffer {
  offerCode: string;
  title: string;
  discountLabel: string;
  targetCategory: ProductCategory;
  status: "Active" | "Suppressed (GDPR Opt-Out)";
  reason: string;
}

// OUTPUT 3: Virtualized Customer 360 Master Record
export interface UnifiedCustomerRecord {
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  loyaltyTier: "VIP" | "Gold" | "Silver" | "Bronze";
  pointsBalance: number;
  preferredBranch: Branch;
  gdprConsent: "Opted In" | "Opted Out";
  favoriteCategory: ProductCategory;
  posSpend: number;
  onlineSpend: number;
  totalSpend: number;
  posOrderCount: number;
  onlineOrderCount: number;
  lastPurchaseAt: string;
  maskedCardOnFile: string;
  personalizedOffer: PersonalizedOffer;
  posTransactions: POSRecord[];
  onlineOrders: OnlineOrderRecord[];
  shipments: LogisticsRecord[];
}

// INTEGRATION METHOD: Change Data Capture (CDC) Event
export interface CDCEvent {
  id: string;
  timestamp: string;
  feed: Feed;
  operation:
    | "INSERT"
    | "UPDATE"
    | "SPIKE"
    | "CONSENT_CHANGE"
    | "RESTOCK"
    | "BATCH_IMPORT"
    | "CATALOG_SYNC"
    | "SHIPMENT_UPDATE"
    | "STOCK_TRANSFER";
  integrationMethod: "Real-Time API" | "CDC" | "Virtualization";
  recordKey: string;
  summary: string;
  latencyMs: number;
}

// CHALLENGE MONITORING: Cross-Channel Data Consistency Alerts
export interface ConsistencyAlert {
  id: string;
  type:
    | "CHANNEL_OVERSELL"
    | "LOW_STOCK"
    | "DELAYED_3PL"
    | "MISSING_TRACKING"
    | "UNLINKED_POS_CUSTOMER";
  severity: "Critical" | "Warning";
  feed: Feed;
  referenceKey: string;
  message: string;
  detectedAt: string;
}

export interface ETLRunReport {
  id: string;
  startTime: string;
  endTime: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS";
  recordsExtracted: Record<Feed, number>;
  recordsLoaded: number;
  anomaliesDetected: number;
  warnings: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userRole: UserRole;
  actorName: string;
  actorId?: string;
  action:
    | "READ_CUSTOMER_360"
    | "INTEGRATION_SYNC"
    | "IMPORT_FEED"
    | "CATALOG_IMPORT"
    | "POS_SALE"
    | "ONLINE_ORDER"
    | "CHECKOUT"
    | "CUSTOMER_CREATED"
    | "SHIPMENT_UPDATED"
    | "STOCK_TRANSFER"
    | "SEASONAL_SPIKE"
    | "INVENTORY_RESTOCK"
    | "GDPR_CONSENT_UPDATED"
    | "EXPORT_REPORT"
    | "SIGN_IN"
    | "SIGN_OUT"
    | "LOGIN_FAILED"
    | "ACCESS_DENIED"
    | "ROLE_SWITCH"
    | "RESET_DEMO";
  targetResource: string;
  status: "ALLOWED" | "RESTRICTED_MASKED";
  details: string;
  hash?: string;
}

export interface AccessIdentity {
  mode: "demo" | "account";
  userId?: string;
  displayName?: string;
  branch?: Branch;
}

export interface SalesSummary {
  totalRevenue: number;
  posManilaRevenue: number;
  posCebuRevenue: number;
  onlineRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  onTimeDeliveryRate: number;
  delayedShipments: number;
  revenueByCategory: Array<{
    category: ProductCategory;
    revenue: number;
    units: number;
  }>;
  carrierPerformance: Array<{
    carrier: Carrier;
    total: number;
    deliveredOrOnTrack: number;
    delayed: number;
  }>;
}

export interface CheckoutReceipt {
  channel: "POS" | "ONLINE";
  branch?: Branch;
  carrier?: Carrier;
  customerId: string;
  customerName: string;
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  promoCode: string;
  totalAmount: number;
  pointsEarned: number;
  maskedCard: string;
  referenceIds: string[];
  trackingNumber?: string;
  timestamp: string;
}

export interface RetailSnapshot {
  accessMode?: "demo" | "account";
  currentRole: UserRole;
  actorName: string;
  actorId?: string;
  branchScope?: Branch;
  posRecords: POSRecord[];
  inventoryRecords: InventoryRecord[];
  crmRecords: CRMRecord[];
  onlineRecords: OnlineOrderRecord[];
  logisticsRecords: LogisticsRecord[];
  stockItems: UnifiedStockItem[];
  customers: UnifiedCustomerRecord[];
  cdcEvents: CDCEvent[];
  consistencyAlerts: ConsistencyAlert[];
  etlReports: ETLRunReport[];
  auditLogs: AuditLogEntry[];
  sourceCounts: Record<Feed, number>;
  salesSummary: SalesSummary;
  auditIntegrity: boolean;
  lastSyncedAt: string;
}

export interface ShopperSummary {
  customerId: string;
  fullName: string;
  loyaltyTier: "VIP" | "Gold" | "Silver" | "Bronze";
  pointsBalance: number;
  favoriteCategory: ProductCategory;
  gdprConsent: "Opted In" | "Opted Out";
  personalizedOffer: PersonalizedOffer;
}

export type ShopProduct = Pick<UnifiedStockItem,
  "sku" | "productName" | "category" | "unitPrice" | "warehouseStock" |
  "unitsSoldOnline" | "brand" | "rating" | "discountPercentage" | "description" |
  "thumbnail" | "images"
>;

export interface ShopSnapshot {
  products: ShopProduct[];
  shoppers: ShopperSummary[];
  lastSyncedAt: string;
}
