import { closeStorage, withStorage } from "./storage";
import { createHash, randomUUID } from "node:crypto";
import {
  initialCDCEvents,
  initialCRMRecords,
  initialLogisticsRecords,
  initialOnlineRecords,
  initialPOSRecords,
} from "./data/mockData";
import {
  buildLiveSeedInventory,
  fetchDummyJsonCatalog,
} from "./data/dummyJsonCatalog";
import { runRetailIntegration } from "./etl/pipeline";
import { applyRetailGovernance, maskPaymentCard } from "./governance/masking";
import { branchScope, isAssignedCashierSale, isSpecialist, ownAuditOnly } from "@/shared/access";
import type {
  AccessIdentity,
  AuditLogEntry,
  CDCEvent,
  CRMRecord,
  CheckoutReceipt,
  ConsistencyAlert,
  ETLRunReport,
  Feed,
  InventoryRecord,
  LogisticsRecord,
  OnlineOrderRecord,
  POSRecord,
  RetailSnapshot,
  SalesSummary,
  ShopProduct,
  ShopSnapshot,
  ShopperSummary,
  UnifiedCustomerRecord,
  UnifiedStockItem,
  UserRole,
} from "@/shared/types";
import { WALK_IN_CUSTOMER_ID, type Branch, type Carrier, type ProductCategory } from "@/shared/retail";

export const actors: Record<UserRole, string> = {
  OPS_MANAGER: "Lourdes Bautista (Store Operations)",
  MARKETING_CRM: "Camille Reyes (Marketing)",
  BRANCH_MANAGER: "Marco Villanueva (Manila Branch)",
  COMPLIANCE_AUDITOR: "Atty. Gabriel Torres (Auditor)",
  CASHIER: "Store Cashier",
  INVENTORY_STAFF: "Iris Mendoza (Inventory)",
  DELIVERY_COORDINATOR: "Rafael Cruz (Delivery)",
};

type Value = string | number | null;
type PayloadRow = { payload: string };

export const closeDatabase = closeStorage;

export function rows<T>(sql: string, ...args: Value[]) {
  return withStorage(
    seedDatabase,
    (db) => db.rows<T>(sql, args),
    undefined,
    ensureCatalogEnriched,
  );
}

export async function first<T>(sql: string, ...args: Value[]) {
  return (await rows<T>(sql, ...args))[0];
}

export async function execute(sql: string, ...args: Value[]) {
  await rows(sql, ...args);
}

export function transaction<T>(fn: () => Promise<T>) {
  return withStorage(seedDatabase, fn, "write", ensureCatalogEnriched);
}

export function readTransaction<T>(fn: () => Promise<T>) {
  return withStorage(seedDatabase, fn, "read", ensureCatalogEnriched);
}

async function ensureCatalogEnriched() {
  const enriched = await first<{ record_key: string }>(
    "SELECT record_key FROM retail_sources WHERE feed='INVENTORY' AND payload LIKE '%\"thumbnail\":%' LIMIT 1",
  );
  if (enriched) return;
  await execute("DELETE FROM retail_sources");
  await execute("DELETE FROM retail_cdc_events");
  await seedSourcesAndCDC();
  await sync();
  await audit(
    "OPS_MANAGER",
    "INTEGRATION_SYNC",
    "Catalog upgrade",
    "Upgraded inventory catalog with live DummyJSON API metadata & images.",
  );
}

async function seedDatabase() {
  await seedSourcesAndCDC();
  await sync();
  await audit(
    "OPS_MANAGER",
    "INTEGRATION_SYNC",
    "Initial seed",
    "Omnichannel retail feeds (POS, Inventory, CRM, Online, 3PL Logistics) initialized with DummyJSON catalog.",
  );
}

async function seedSourcesAndCDC() {
  const liveInventory = await buildLiveSeedInventory();
  const invMap = new Map(liveInventory.map((item) => [item.sku, item]));

  const syncedPOS = initialPOSRecords.map((tx) => {
    const item = invMap.get(tx.sku);
    const unitPrice = item?.unitPrice ?? tx.unitPrice;
    return {
      ...tx,
      productName: item?.productName ?? tx.productName,
      unitPrice,
      totalAmount: unitPrice * tx.quantity,
    };
  });

  const syncedOnline = initialOnlineRecords.map((ord) => {
    const item = invMap.get(ord.sku);
    return {
      ...ord,
      productName: item?.productName ?? ord.productName,
      totalAmount: item ? item.unitPrice * ord.quantity : ord.totalAmount,
    };
  });

  await upsert("POS", syncedPOS);
  await upsert("INVENTORY", liveInventory);
  await upsert("CRM", initialCRMRecords);
  await upsert("ONLINE", syncedOnline);
  await upsert("LOGISTICS", initialLogisticsRecords);
  for (const ev of [...initialCDCEvents].reverse()) {
    await execute(
      "INSERT INTO retail_cdc_events(payload) VALUES(?)",
      JSON.stringify(ev),
    );
  }
}

export async function appendCDC(event: Omit<CDCEvent, "id">) {
  const full: CDCEvent = {
    id: `CDC-${randomUUID().slice(0, 6).toUpperCase()}`,
    ...event,
  };
  await execute(
    "INSERT INTO retail_cdc_events(payload) VALUES(?)",
    JSON.stringify(full),
  );
  return full;
}

function recordKeyForFeed(
  feed: Feed,
  row:
    | POSRecord
    | InventoryRecord
    | CRMRecord
    | OnlineOrderRecord
    | LogisticsRecord,
): string {
  switch (feed) {
    case "POS":
      return (row as POSRecord).txId.trim().toUpperCase();
    case "INVENTORY":
      return (row as InventoryRecord).sku.trim().toUpperCase();
    case "CRM":
      return (row as CRMRecord).customerId.trim().toUpperCase();
    case "ONLINE":
      return (row as OnlineOrderRecord).orderId.trim().toUpperCase();
    case "LOGISTICS":
      return (row as LogisticsRecord).shipmentId.trim().toUpperCase();
  }
}

export async function upsert(
  feed: Feed,
  input: Array<
    POSRecord | InventoryRecord | CRMRecord | OnlineOrderRecord | LogisticsRecord
  >,
) {
  const existing = new Set(
    (
      await rows<{ record_key: string }>(
        "SELECT record_key FROM retail_sources WHERE feed=?",
        feed,
      )
    ).map((r) => r.record_key),
  );
  const batch = new Map<string, string>();
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;

  for (const row of input) {
    const key = recordKeyForFeed(feed, row);
    if (batch.has(key)) duplicates++;
    if (existing.has(key) || batch.has(key)) updated++;
    else inserted++;
    batch.set(key, JSON.stringify(row));
  }

  if (batch.size) {
    await execute(
      "INSERT INTO retail_sources(feed, record_key, payload) VALUES " +
        Array.from(batch, () => "(?,?,?)").join(",") +
        " ON CONFLICT(feed, record_key) DO UPDATE SET payload=excluded.payload",
      ...Array.from(batch).flatMap(([key, payload]) => [feed, key, payload]),
    );
  }
  return { inserted, updated, duplicates };
}

export async function sync() {
  const allSources = await rows<{ feed: Feed; payload: string }>(
    "SELECT feed, payload FROM retail_sources ORDER BY feed, record_key",
  );
  const pos: POSRecord[] = [];
  const inventory: InventoryRecord[] = [];
  const crm: CRMRecord[] = [];
  const online: OnlineOrderRecord[] = [];
  const logistics: LogisticsRecord[] = [];

  for (const row of allSources) {
    const parsed = JSON.parse(row.payload);
    if (row.feed === "POS") pos.push(parsed);
    else if (row.feed === "INVENTORY") inventory.push(parsed);
    else if (row.feed === "CRM") crm.push(parsed);
    else if (row.feed === "ONLINE") online.push(parsed);
    else if (row.feed === "LOGISTICS") logistics.push(parsed);
  }

  const result = runRetailIntegration(pos, inventory, crm, online, logistics);

  await execute("DELETE FROM retail_master");
  const masterRows: Array<[string, unknown]> = [
    ["meta:stock", result.stockItems],
    ["meta:alerts", result.consistencyAlerts],
    [
      "meta:sales",
      { salesSummary: result.salesSummary, lastSyncedAt: result.report.endTime },
    ],
    ...result.customers.map(
      (c): [string, unknown] => [`cust:${c.customerId}`, c],
    ),
  ];

  await execute(
    "INSERT INTO retail_master(id, payload) VALUES " +
      masterRows.map(() => "(?,?)").join(","),
    ...masterRows.flatMap(([id, obj]) => [id, JSON.stringify(obj)]),
  );

  await execute(
    "INSERT INTO retail_etl_runs(payload) VALUES(?)",
    JSON.stringify(result.report),
  );
  return result.report;
}

export async function customerById(
  customerId: string,
): Promise<UnifiedCustomerRecord | undefined> {
  const row = await first<PayloadRow>(
    "SELECT payload FROM retail_master WHERE id=?",
    `cust:${customerId.trim().toUpperCase()}`,
  );
  return row ? (JSON.parse(row.payload) as UnifiedCustomerRecord) : undefined;
}

export async function audit(
  role: UserRole,
  action: AuditLogEntry["action"],
  target: string,
  details: string,
  status: AuditLogEntry["status"] = "ALLOWED",
  identity?: AccessIdentity,
): Promise<AuditLogEntry> {
  return transaction(async () => {
    const entry: AuditLogEntry = {
      id: "AUD-" + randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      userRole: role,
      actorName: identity?.displayName || actors[role],
      ...(identity?.userId ? { actorId: identity.userId } : {}),
      action,
      targetResource: target,
      details,
      status,
    };
    const previous =
      (
        await first<{ hash: string }>(
          "SELECT hash FROM retail_audit ORDER BY seq DESC LIMIT 1",
        )
      )?.hash || "GENESIS";
    const payload = JSON.stringify(entry);
    const hash = createHash("sha256")
      .update(previous + payload)
      .digest("hex");
    await execute(
      "INSERT INTO retail_audit(payload, previous_hash, hash) VALUES(?,?,?)",
      payload,
      previous,
      hash,
    );
    return { ...entry, hash };
  });
}

export type AuditChainRow = {
  payload: string;
  previous_hash: string;
  hash: string;
};

export function verifyAuditRows(chain: AuditChainRow[]) {
  let previous = "GENESIS";
  let valid = true;
  const entries = chain.map((row) => {
    if (
      row.previous_hash !== previous ||
      createHash("sha256")
        .update(previous + row.payload)
        .digest("hex") !== row.hash
    ) {
      valid = false;
    }
    previous = row.hash;
    return { ...JSON.parse(row.payload), hash: row.hash } as AuditLogEntry;
  });
  return { entries: entries.reverse(), valid };
}

export async function auditTrail() {
  const chain = await rows<AuditChainRow>(
    "SELECT payload, previous_hash, hash FROM retail_audit ORDER BY seq",
  );
  return verifyAuditRows(chain);
}

export async function recordPOSSale(
  role: UserRole,
  identity: AccessIdentity | undefined,
  input: {
    branch: Branch;
    sku: string;
    customerId: string;
    quantity: number;
    paymentMethod: "Card" | "Cash" | "GCash";
  },
) {
  const scope = branchScope(role, identity);
  const branch: Branch = scope || input.branch;
  const skuKey = input.sku.trim().toUpperCase();
  const invRow = await first<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='INVENTORY' AND record_key=?",
    skuKey,
  );
  if (!invRow) throw new Error(`SKU ${skuKey} was not found in Inventory.`);
  const inv = JSON.parse(invRow.payload) as InventoryRecord;
  const qty = Math.max(1, Math.min(50, Math.round(input.quantity)));

  const now = new Date().toISOString();
  if (branch === "Manila") inv.manilaStock -= qty;
  else inv.cebuStock -= qty;
  inv.lastUpdated = now;

  const txId = `POS-${Date.now().toString().slice(-4)}`;
  const customerId = input.customerId.trim().toUpperCase() || WALK_IN_CUSTOMER_ID;
  const tx: POSRecord = {
    txId,
    branch,
    customerId,
    sku: inv.sku,
    productName: inv.productName,
    quantity: qty,
    unitPrice: inv.unitPrice,
    totalAmount: inv.unitPrice * qty,
    paymentMethod: input.paymentMethod,
    cardNumber:
      input.paymentMethod === "Card"
        ? `4532-8910-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
        : "N/A",
    timestamp: now,
  };

  await upsert("POS", [tx]);
  await upsert("INVENTORY", [inv]);
  await appendCDC({
    timestamp: now,
    feed: "POS",
    operation: "INSERT",
    integrationMethod: "Real-Time API",
    recordKey: tx.txId,
    summary: `${branch} POS synced ${tx.txId} (${inv.sku} × ${qty}, ₱${tx.totalAmount.toLocaleString()})`,
    latencyMs: 18 + Math.floor(Math.random() * 14),
  });
  await appendCDC({
    timestamp: now,
    feed: "INVENTORY",
    operation: "UPDATE",
    integrationMethod: "CDC",
    recordKey: inv.sku,
    summary: `Real-time stock sync deducted ${qty} unit(s) from ${branch} stock (${inv.sku})`,
    latencyMs: 22 + Math.floor(Math.random() * 15),
  });
  await sync();
  await audit(
    role,
    "POS_SALE",
    tx.txId,
    `Recorded ${branch} POS sale for ${inv.sku} × ${qty} (${customerId}).`,
    "ALLOWED",
    identity,
  );
}

export async function simulateSeasonalSpike(
  role: UserRole,
  identity?: AccessIdentity,
) {
  const now = new Date().toISOString();
  const invRows = await rows<{ record_key: string; payload: string }>(
    "SELECT record_key, payload FROM retail_sources WHERE feed='INVENTORY'",
  );
  const invMap = new Map<string, InventoryRecord>(
    invRows.map((r) => [r.record_key, JSON.parse(r.payload) as InventoryRecord]),
  );

  const sku103 = invMap.get("SKU-103");
  const sku106 = invMap.get("SKU-106");
  const sku101 = invMap.get("SKU-101");

  const updatedInv: InventoryRecord[] = [];
  if (sku103) {
    sku103.warehouseStock = -3;
    sku103.manilaStock = Math.max(0, sku103.manilaStock - 2);
    sku103.lastUpdated = now;
    updatedInv.push(sku103);
  }
  if (sku106) {
    sku106.warehouseStock = 1;
    sku106.cebuStock = Math.max(0, sku106.cebuStock - 2);
    sku106.lastUpdated = now;
    updatedInv.push(sku106);
  }
  if (sku101) {
    sku101.warehouseStock = Math.max(2, sku101.warehouseStock - 8);
    sku101.lastUpdated = now;
    updatedInv.push(sku101);
  }

  const tag = Date.now().toString().slice(-3);
  const name103 = sku103?.productName || "Eyeshadow Palette with Mirror";
  const price103 = sku103?.unitPrice || 1120;
  const name106 = sku106?.productName || "Nike Air Jordan 1 Red And Black";
  const price106 = sku106?.unitPrice || 8400;
  const name101 = sku101?.productName || "Apple Airpods";
  const price101 = sku101?.unitPrice || 7280;

  const burstPOS: POSRecord[] = [
    {
      txId: `SPK-POS-${tag}A`,
      branch: "Manila",
      customerId: "CUST-001",
      sku: "SKU-103",
      productName: name103,
      quantity: 2,
      unitPrice: price103,
      totalAmount: price103 * 2,
      paymentMethod: "Card",
      cardNumber: "4532-8910-4421-4242",
      timestamp: now,
    },
    {
      txId: `SPK-POS-${tag}B`,
      branch: "Cebu",
      customerId: "CUST-004",
      sku: "SKU-106",
      productName: name106,
      quantity: 2,
      unitPrice: price106,
      totalAmount: price106 * 2,
      paymentMethod: "GCash",
      cardNumber: "N/A",
      timestamp: now,
    },
  ];

  const burstOnline: OnlineOrderRecord[] = [
    {
      orderId: `SPK-ORD-${tag}1`,
      customerId: "CUST-002",
      sku: "SKU-103",
      productName: name103,
      quantity: 6,
      totalAmount: price103 * 6,
      paymentMethod: "Card",
      cardNumber: "5412-7512-3456-9811",
      promoCode: "MEGA1111",
      orderStatus: "Processing",
      orderedAt: now,
    },
    {
      orderId: `SPK-ORD-${tag}2`,
      customerId: "CUST-005",
      sku: "SKU-101",
      productName: name101,
      quantity: 3,
      totalAmount: price101 * 3,
      paymentMethod: "Card",
      cardNumber: "4916-3310-7782-1190",
      promoCode: "VIP1111",
      orderStatus: "Shipped",
      orderedAt: now,
    },
    {
      orderId: `SPK-ORD-${tag}3`,
      customerId: "CUST-001",
      sku: "SKU-106",
      productName: name106,
      quantity: 2,
      totalAmount: price106 * 2,
      paymentMethod: "Card",
      cardNumber: "4532-8910-4421-4242",
      promoCode: "MEGA1111",
      orderStatus: "Shipped",
      orderedAt: now,
    },
    {
      orderId: `SPK-ORD-${tag}4`,
      customerId: "CUST-003",
      sku: "SKU-101",
      productName: name101,
      quantity: 2,
      totalAmount: price101 * 2,
      paymentMethod: "Maya",
      cardNumber: "N/A",
      promoCode: "MEGA1111",
      orderStatus: "Processing",
      orderedAt: now,
    },
  ];

  const burstLogistics: LogisticsRecord[] = [
    {
      shipmentId: `SPK-SHP-${tag}1`,
      orderId: `SPK-ORD-${tag}1`,
      customerId: "CUST-002",
      carrier: "J&T Express",
      trackingNumber: `JT-SPK-${tag}9`,
      status: "Delayed",
      estimatedDelivery: "2026-11-24",
      delayReason: "11.11 Mega Sale carrier sorting congestion",
      updatedAt: now,
    },
  ];

  await upsert("INVENTORY", updatedInv);
  await upsert("POS", burstPOS);
  await upsert("ONLINE", burstOnline);
  await upsert("LOGISTICS", burstLogistics);

  await appendCDC({
    timestamp: now,
    feed: "ONLINE",
    operation: "SPIKE",
    integrationMethod: "Real-Time API",
    recordKey: `SPK-ORD-${tag}1..4`,
    summary:
      "11.11 Flash Sale burst: 4 Online + 2 POS concurrent orders ingested via Real-Time API",
    latencyMs: 64,
  });
  await appendCDC({
    timestamp: now,
    feed: "INVENTORY",
    operation: "SPIKE",
    integrationMethod: "CDC",
    recordKey: "SKU-103",
    summary: `CDC detected channel oversell on SKU-103 (${name103}: Online warehouse -3 after concurrent checkout)`,
    latencyMs: 31,
  });
  await appendCDC({
    timestamp: now,
    feed: "LOGISTICS",
    operation: "SPIKE",
    integrationMethod: "CDC",
    recordKey: `SPK-SHP-${tag}1`,
    summary:
      "J&T Express webhook flagged 11.11 peak carrier backlog on SPK-SHP",
    latencyMs: 55,
  });

  await sync();
  await audit(
    role,
    "SEASONAL_SPIKE",
    "11.11 Flash Sale",
    "Simulated seasonal traffic spike (6 burst orders); triggered oversell & 3PL delay checks.",
    "ALLOWED",
    identity,
  );
}

export async function restockSKU(
  role: UserRole,
  identity: AccessIdentity | undefined,
  sku: string,
  amount = 20,
) {
  const key = sku.trim().toUpperCase();
  const invRow = await first<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='INVENTORY' AND record_key=?",
    key,
  );
  if (!invRow) throw new Error(`SKU ${key} not found.`);
  const inv = JSON.parse(invRow.payload) as InventoryRecord;
  const now = new Date().toISOString();

  const manilaAdd = Math.floor(amount * 0.3);
  const cebuAdd = Math.floor(amount * 0.3);
  const whAdd = amount - manilaAdd - cebuAdd;

  inv.manilaStock += manilaAdd;
  inv.cebuStock += cebuAdd;
  inv.warehouseStock += whAdd;
  inv.lastUpdated = now;

  await upsert("INVENTORY", [inv]);
  await appendCDC({
    timestamp: now,
    feed: "INVENTORY",
    operation: "RESTOCK",
    integrationMethod: "Real-Time API",
    recordKey: inv.sku,
    summary: `Replenished ${inv.sku} (+${manilaAdd} Manila, +${cebuAdd} Cebu, +${whAdd} Online)`,
    latencyMs: 16,
  });
  await sync();
  await audit(
    role,
    "INVENTORY_RESTOCK",
    inv.sku,
    `Restocked ${inv.sku} (+${amount} units across Manila, Cebu, Online).`,
    "ALLOWED",
    identity,
  );
}

export async function importCatalogProduct(
  role: UserRole,
  identity: AccessIdentity | undefined,
  productId: number,
): Promise<InventoryRecord> {
  const { products } = await fetchDummyJsonCatalog();
  const product = products.find((p) => p.id === productId);
  if (!product) {
    throw new Error(`Catalog product #${productId} was not found in DummyJSON.`);
  }

  const invRows = await rows<{ record_key: string; payload: string }>(
    "SELECT record_key, payload FROM retail_sources WHERE feed='INVENTORY'",
  );
  const existing = invRows
    .map((r) => JSON.parse(r.payload) as InventoryRecord)
    .find((r) => r.externalId === product.id);
  const sku =
    existing?.sku || `SKU-DJ-${String(product.id).padStart(3, "0")}`;

  const manilaAdd = Math.max(4, Math.floor(product.stock * 0.3));
  const cebuAdd = Math.max(3, Math.floor(product.stock * 0.25));
  const whAdd = Math.max(5, product.stock - manilaAdd - cebuAdd);
  const now = new Date().toISOString();

  const record: InventoryRecord = {
    sku,
    productName: product.title,
    category: product.category,
    unitPrice: product.unitPricePhp,
    manilaStock: existing ? existing.manilaStock + manilaAdd : manilaAdd,
    cebuStock: existing ? existing.cebuStock + cebuAdd : cebuAdd,
    warehouseStock: existing ? existing.warehouseStock + whAdd : whAdd,
    reorderPoint: existing?.reorderPoint ?? 15,
    lastUpdated: now,
    externalId: product.id,
    externalSku: product.sku,
    brand: product.brand,
    rating: product.rating,
    discountPercentage: product.discountPercentage,
    description: product.description,
    thumbnail: product.thumbnail,
    images: product.images,
  };

  await upsert("INVENTORY", [record]);
  await appendCDC({
    timestamp: now,
    feed: "INVENTORY",
    operation: "CATALOG_SYNC",
    integrationMethod: "Real-Time API",
    recordKey: sku,
    summary: `Synced "${product.title}" (${sku}) from DummyJSON Catalog API (+${manilaAdd} Manila, +${cebuAdd} Cebu, +${whAdd} Online)`,
    latencyMs: 36,
  });
  await sync();
  await audit(
    role,
    "CATALOG_IMPORT",
    sku,
    `Imported "${product.title}" (DummyJSON #${product.id}, ${product.brand}) into ${sku}.`,
    "ALLOWED",
    identity,
  );
  return record;
}

export async function toggleGDPRConsent(
  role: UserRole,
  identity: AccessIdentity | undefined,
  customerId: string,
) {
  const key = customerId.trim().toUpperCase();
  const crmRow = await first<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='CRM' AND record_key=?",
    key,
  );
  if (!crmRow) throw new Error(`Customer ${key} not found.`);
  const member = JSON.parse(crmRow.payload) as CRMRecord;
  member.gdprConsent =
    member.gdprConsent === "Opted In" ? "Opted Out" : "Opted In";
  const now = new Date().toISOString();

  await upsert("CRM", [member]);
  await appendCDC({
    timestamp: now,
    feed: "CRM",
    operation: "CONSENT_CHANGE",
    integrationMethod: "Real-Time API",
    recordKey: member.customerId,
    summary: `CRM GDPR preference switched to ${member.gdprConsent} for ${member.customerId}`,
    latencyMs: 14,
  });
  await sync();
  await audit(
    role,
    "GDPR_CONSENT_UPDATED",
    member.customerId,
    `Updated GDPR consent to ${member.gdprConsent} (offers ${member.gdprConsent === "Opted In" ? "enabled" : "suppressed"}).`,
    "ALLOWED",
    identity,
  );
  return member.gdprConsent;
}

export function computeOfferDiscount(
  customer: CRMRecord | undefined,
  lines: Array<{ category: ProductCategory; lineTotal: number }>,
): { discountAmount: number; promoCode: string } {
  if (!customer || customer.gdprConsent === "Opted Out") {
    return { discountAmount: 0, promoCode: "NONE" };
  }
  const matchingSubtotal = lines
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

export async function processCheckout(
  role: UserRole,
  identity: AccessIdentity | undefined,
  input: {
    channel: "POS" | "ONLINE";
    branch?: Branch;
    customerId: string;
    paymentMethod: "Card" | "Cash" | "GCash" | "Maya";
    cardNumber?: string;
    carrier?: Carrier;
    simulated?: true;
    items: Array<{ sku: string; quantity: number }>;
  },
): Promise<CheckoutReceipt> {
  if (!input.items.length) {
    throw new Error("Add at least one item to checkout.");
  }

  const scope = branchScope(role, identity);
  const channel = scope ? "POS" : input.channel;
  const branch: Branch = scope || input.branch || "Manila";
  if (role === "CASHIER" && (input.channel !== "POS" ||
    !isAssignedCashierSale(identity, input.branch, input.customerId))) {
    throw new Error("Cashiers can only record walk-in sales at their assigned branch.");
  }
  const carrier: Carrier = input.carrier || "LBC Express";
  const now = new Date().toISOString();

  // Merge duplicate SKUs inside one checkout basket
  const merged = new Map<string, number>();
  for (const item of input.items) {
    const skuKey = item.sku.trim().toUpperCase();
    const qty = Math.max(1, Math.min(50, Math.round(item.quantity)));
    merged.set(skuKey, (merged.get(skuKey) || 0) + qty);
  }

  const invRows = await rows<{ record_key: string; payload: string }>(
    "SELECT record_key, payload FROM retail_sources WHERE feed='INVENTORY'",
  );
  const invMap = new Map<string, InventoryRecord>(
    invRows.map((r) => [r.record_key, JSON.parse(r.payload) as InventoryRecord]),
  );

  const lines: Array<{
    inv: InventoryRecord;
    quantity: number;
    lineTotal: number;
  }> = [];

  for (const [skuKey, qty] of merged.entries()) {
    const inv = invMap.get(skuKey);
    if (!inv) throw new Error(`SKU ${skuKey} was not found in Inventory.`);
    const available = branch === "Manila" ? inv.manilaStock : inv.cebuStock;
    if (role === "CASHIER" && qty > available) {
      throw new Error(`Only ${Math.max(0, available)} ${inv.productName} available at ${branch}.`);
    }
    lines.push({
      inv,
      quantity: qty,
      lineTotal: inv.unitPrice * qty,
    });
  }

  const customerKey =
    input.customerId.trim().toUpperCase() ||
    (channel === "POS" ? WALK_IN_CUSTOMER_ID : "CUST-001");
  const crmRow =
    customerKey === WALK_IN_CUSTOMER_ID
      ? undefined
      : await first<PayloadRow>(
          "SELECT payload FROM retail_sources WHERE feed='CRM' AND record_key=?",
          customerKey,
        );
  const member = crmRow ? (JSON.parse(crmRow.payload) as CRMRecord) : undefined;
  if (customerKey !== WALK_IN_CUSTOMER_ID && !member) {
    throw new Error(`Customer ${customerKey} was not found in CRM.`);
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const { discountAmount, promoCode } = computeOfferDiscount(
    member,
    lines.map((l) => ({
      category: l.inv.category,
      lineTotal: l.lineTotal,
    })),
  );
  const totalAmount = Math.max(0, subtotal - discountAmount);

  // Distribute offer discount cleanly across matching favorite-category lines
  const matchingLines = member
    ? lines.filter((l) => l.inv.category === member.favoriteCategory)
    : [];
  let remainingDiscount = discountAmount;
  const lineFinalTotals = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (remainingDiscount > 0 && member && line.inv.category === member.favoriteCategory) {
      const isLastMatching =
        matchingLines[matchingLines.length - 1]?.inv.sku === line.inv.sku;
      const matchingSub = matchingLines.reduce((s, m) => s + m.lineTotal, 0) || 1;
      const share = isLastMatching
        ? remainingDiscount
        : Math.min(
            remainingDiscount,
            Math.round((line.lineTotal / matchingSub) * discountAmount),
          );
      const bounded = Math.min(share, Math.max(0, line.lineTotal - line.quantity));
      remainingDiscount -= bounded;
      lineFinalTotals.set(line.inv.sku, line.lineTotal - bounded);
    } else {
      lineFinalTotals.set(line.inv.sku, line.lineTotal);
    }
  }

  const normalizedDigits = (input.cardNumber || "").replace(/\D/g, "");
  const rawCard =
    input.paymentMethod === "Card"
      ? normalizedDigits.length >= 12
        ? `${normalizedDigits.slice(0, 4)}-${normalizedDigits.slice(4, 8)}-${normalizedDigits.slice(8, 12)}-${normalizedDigits.slice(-4).padStart(4, "0")}`
        : `4532-8910-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
      : "N/A";

  const batchTag = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
  const updatedInventory: InventoryRecord[] = [];
  const referenceIds: string[] = [];
  let trackingNumber: string | undefined;

  if (channel === "POS") {
    const posMethod: POSRecord["paymentMethod"] =
      input.paymentMethod === "Maya" ? "GCash" : input.paymentMethod;
    const posRowsToSave: POSRecord[] = lines.map((line, idx) => {
      const { inv, quantity } = line;
      if (branch === "Manila") inv.manilaStock -= quantity;
      else inv.cebuStock -= quantity;
      inv.lastUpdated = now;
      updatedInventory.push(inv);

      const finalTotal = lineFinalTotals.get(inv.sku) ?? line.lineTotal;
      const txId = lines.length > 1 ? `POS-${batchTag}-${idx + 1}` : `POS-${batchTag}`;
      referenceIds.push(txId);
      return {
        txId,
        branch,
        customerId: customerKey,
        sku: inv.sku,
        productName: inv.productName,
        quantity,
        unitPrice: Math.round((finalTotal / quantity) * 100) / 100,
        totalAmount: finalTotal,
        paymentMethod: posMethod,
        cardNumber: rawCard,
        timestamp: now,
      };
    });

    await upsert("POS", posRowsToSave);
    await upsert("INVENTORY", updatedInventory);
    await appendCDC({
      timestamp: now,
      feed: "POS",
      operation: "INSERT",
      integrationMethod: "Real-Time API",
      recordKey: referenceIds[0],
      summary: `${branch} POS checked out ${lines.reduce((s, l) => s + l.quantity, 0)} item(s) (₱${totalAmount.toLocaleString()})${discountAmount > 0 ? ` with ${promoCode}` : ""}`,
      latencyMs: 21,
    });
  } else {
    const onlineMethod: OnlineOrderRecord["paymentMethod"] =
      input.paymentMethod === "Cash" ? "Maya" : input.paymentMethod;
    trackingNumber = `${carrier.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}-${batchTag}`;
    const eta = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);

    const onlineRowsToSave: OnlineOrderRecord[] = [];
    const logisticsRowsToSave: LogisticsRecord[] = [];

    lines.forEach((line, idx) => {
      const { inv, quantity } = line;
      inv.warehouseStock -= quantity;
      inv.lastUpdated = now;
      updatedInventory.push(inv);

      const orderId =
        lines.length > 1 ? `ORD-${batchTag}-${idx + 1}` : `ORD-${batchTag}`;
      const shipmentId =
        lines.length > 1 ? `SHP-${batchTag}-${idx + 1}` : `SHP-${batchTag}`;
      const finalTotal = lineFinalTotals.get(inv.sku) ?? line.lineTotal;
      referenceIds.push(orderId);

      onlineRowsToSave.push({
        orderId,
        customerId: customerKey,
        sku: inv.sku,
        productName: inv.productName,
        quantity,
        totalAmount: finalTotal,
        paymentMethod: onlineMethod,
        cardNumber: rawCard,
        promoCode,
        orderStatus: "Shipped",
        orderedAt: now,
      });

      logisticsRowsToSave.push({
        shipmentId,
        orderId,
        customerId: customerKey,
        carrier,
        trackingNumber: trackingNumber!,
        status: "Label Created",
        estimatedDelivery: eta,
        updatedAt: now,
      });
    });

    await upsert("ONLINE", onlineRowsToSave);
    await upsert("LOGISTICS", logisticsRowsToSave);
    await upsert("INVENTORY", updatedInventory);
    await appendCDC({
      timestamp: now,
      feed: "ONLINE",
      operation: "INSERT",
      integrationMethod: "Real-Time API",
      recordKey: referenceIds[0],
      summary: `${input.simulated ? "Website checkout simulation" : "Online Storefront"} captured ${lines.reduce((s, l) => s + l.quantity, 0)} item(s) (₱${totalAmount.toLocaleString()}) & booked ${carrier} (${trackingNumber})`,
      latencyMs: 28,
    });
  }

  await appendCDC({
    timestamp: now,
    feed: "INVENTORY",
    operation: "UPDATE",
    integrationMethod: "CDC",
    recordKey: lines.map((l) => l.inv.sku).join(", "),
    summary: `CDC deducted stock for ${lines.map((l) => `${l.inv.sku} × ${l.quantity}`).join(", ")} (${channel === "POS" ? `${branch} POS` : "Online"})`,
    latencyMs: 19,
  });

  const pointsEarned = member ? Math.floor(totalAmount / 20) : 0;
  if (member && pointsEarned > 0) {
    member.pointsBalance += pointsEarned;
    await upsert("CRM", [member]);
  }

  await sync();
  await audit(
    role,
    "CHECKOUT",
    referenceIds.join(", "),
    `${input.simulated ? "Simulated" : "Completed"} ${channel}${channel === "POS" ? ` (${branch})` : ` (${carrier})`} checkout: ${lines.reduce((s, l) => s + l.quantity, 0)} unit(s), ₱${totalAmount.toLocaleString()}${discountAmount > 0 ? ` (${promoCode} -₱${discountAmount.toLocaleString()})` : ""}.`,
    "ALLOWED",
    identity,
  );

  return {
    channel,
    ...(channel === "POS" ? { branch } : { carrier, trackingNumber }),
    customerId: customerKey,
    customerName: member?.fullName || "Walk-In Guest",
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    subtotal,
    discountAmount,
    promoCode,
    totalAmount,
    pointsEarned,
    maskedCard: maskPaymentCard(rawCard, role),
    referenceIds,
    timestamp: now,
  };
}

export async function createCustomer(
  role: UserRole,
  identity: AccessIdentity | undefined,
  input: {
    fullName: string;
    email: string;
    phone: string;
    preferredBranch: Branch;
    favoriteCategory: ProductCategory;
    loyaltyTier: CRMRecord["loyaltyTier"];
    gdprConsent: CRMRecord["gdprConsent"];
  },
): Promise<CRMRecord> {
  const email = input.email.trim().toLowerCase();
  const crmRows = await rows<{ record_key: string; payload: string }>(
    "SELECT record_key, payload FROM retail_sources WHERE feed='CRM'",
  );
  const existing = crmRows.map((r) => JSON.parse(r.payload) as CRMRecord);
  if (existing.some((c) => c.email.trim().toLowerCase() === email)) {
    throw new Error(`A customer with email ${email} is already registered.`);
  }

  const maxNum = existing.reduce((max, c) => {
    const match = /^CUST-(\d+)$/i.exec(c.customerId);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const customerId = `CUST-${String(maxNum + 1).padStart(3, "0")}`;

  const startingPoints: Record<CRMRecord["loyaltyTier"], number> = {
    Bronze: 250,
    Silver: 1000,
    Gold: 2500,
    VIP: 4500,
  };

  const now = new Date().toISOString();
  const record: CRMRecord = {
    customerId,
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    email,
    phone: input.phone.trim(),
    loyaltyTier: input.loyaltyTier,
    pointsBalance: startingPoints[input.loyaltyTier],
    preferredBranch: input.preferredBranch,
    gdprConsent: input.gdprConsent,
    favoriteCategory: input.favoriteCategory,
    joinedAt: now.slice(0, 10),
  };

  await upsert("CRM", [record]);
  await appendCDC({
    timestamp: now,
    feed: "CRM",
    operation: "INSERT",
    integrationMethod: "Real-Time API",
    recordKey: customerId,
    summary: `Registered CRM profile ${customerId} (${record.fullName}, ${record.loyaltyTier}, ${record.gdprConsent})`,
    latencyMs: 18,
  });
  await sync();
  await audit(
    role,
    "CUSTOMER_CREATED",
    customerId,
    `Created CRM customer ${record.fullName} (${record.loyaltyTier}, GDPR ${record.gdprConsent}).`,
    "ALLOWED",
    identity,
  );
  return record;
}

export async function dispatchOnlineOrder(
  role: UserRole,
  identity: AccessIdentity | undefined,
  orderId: string,
  carrier: Carrier,
): Promise<LogisticsRecord> {
  const key = orderId.trim().toUpperCase();
  const orderRow = await first<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='ONLINE' AND record_key=?",
    key,
  );
  if (!orderRow) throw new Error(`Online order ${key} was not found.`);
  const order = JSON.parse(orderRow.payload) as OnlineOrderRecord;

  const existingShipments = await rows<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='LOGISTICS'",
  );
  if (
    existingShipments.some(
      (r) => (JSON.parse(r.payload) as LogisticsRecord).orderId === key,
    )
  ) {
    throw new Error(`Order ${key} already has a 3PL shipment assigned.`);
  }

  const now = new Date().toISOString();
  const tag = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
  const shipment: LogisticsRecord = {
    shipmentId: `SHP-${tag}`,
    orderId: key,
    customerId: order.customerId,
    carrier,
    trackingNumber: `${carrier.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}-${tag}`,
    status: "In Transit",
    estimatedDelivery: new Date(Date.now() + 2 * 86400_000)
      .toISOString()
      .slice(0, 10),
    updatedAt: now,
  };

  order.orderStatus = "Shipped";
  await upsert("LOGISTICS", [shipment]);
  await upsert("ONLINE", [order]);
  await appendCDC({
    timestamp: now,
    feed: "LOGISTICS",
    operation: "SHIPMENT_UPDATE",
    integrationMethod: "Real-Time API",
    recordKey: shipment.shipmentId,
    summary: `Dispatched ${key} via ${carrier} (${shipment.trackingNumber})`,
    latencyMs: 29,
  });
  await sync();
  await audit(
    role,
    "SHIPMENT_UPDATED",
    shipment.shipmentId,
    `Assigned ${carrier} (${shipment.trackingNumber}) to ${key} and set status In Transit.`,
    "ALLOWED",
    identity,
  );
  return shipment;
}

export async function updateShipmentStatus(
  role: UserRole,
  identity: AccessIdentity | undefined,
  shipmentId: string,
  status: LogisticsRecord["status"],
  delayReason?: string,
): Promise<LogisticsRecord> {
  const key = shipmentId.trim().toUpperCase();
  const shpRow = await first<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='LOGISTICS' AND record_key=?",
    key,
  );
  if (!shpRow) throw new Error(`Shipment ${key} was not found.`);
  const shipment = JSON.parse(shpRow.payload) as LogisticsRecord;
  const now = new Date().toISOString();

  shipment.status = status;
  shipment.updatedAt = now;
  if (status === "Delayed") {
    shipment.delayReason = delayReason?.trim() || "Carrier hub congestion";
  } else {
    delete shipment.delayReason;
  }

  await upsert("LOGISTICS", [shipment]);

  if (status === "Delivered") {
    const orderRow = await first<PayloadRow>(
      "SELECT payload FROM retail_sources WHERE feed='ONLINE' AND record_key=?",
      shipment.orderId,
    );
    if (orderRow) {
      const order = JSON.parse(orderRow.payload) as OnlineOrderRecord;
      order.orderStatus = "Delivered";
      await upsert("ONLINE", [order]);
    }
  }

  await appendCDC({
    timestamp: now,
    feed: "LOGISTICS",
    operation: "SHIPMENT_UPDATE",
    integrationMethod: "CDC",
    recordKey: shipment.shipmentId,
    summary: `${shipment.carrier} (${shipment.trackingNumber}) updated to ${status}`,
    latencyMs: 27,
  });
  await sync();
  await audit(
    role,
    "SHIPMENT_UPDATED",
    shipment.shipmentId,
    `Updated ${shipment.orderId} shipment (${shipment.carrier}) to ${status}.`,
    "ALLOWED",
    identity,
  );
  return shipment;
}

export async function transferStock(
  role: UserRole,
  identity: AccessIdentity | undefined,
  input: {
    sku: string;
    fromChannel: "Manila" | "Cebu" | "Online";
    toChannel: "Manila" | "Cebu" | "Online";
    quantity: number;
  },
): Promise<InventoryRecord> {
  if (input.fromChannel === input.toChannel) {
    throw new Error("Source and destination channels must be different.");
  }
  const key = input.sku.trim().toUpperCase();
  const invRow = await first<PayloadRow>(
    "SELECT payload FROM retail_sources WHERE feed='INVENTORY' AND record_key=?",
    key,
  );
  if (!invRow) throw new Error(`SKU ${key} was not found in Inventory.`);
  const inv = JSON.parse(invRow.payload) as InventoryRecord;
  const qty = Math.max(1, Math.min(500, Math.round(input.quantity)));

  const channelField = {
    Manila: "manilaStock",
    Cebu: "cebuStock",
    Online: "warehouseStock",
  } as const;

  const fromField = channelField[input.fromChannel];
  const toField = channelField[input.toChannel];

  if (inv[fromField] < qty) {
    throw new Error(
      `Only ${inv[fromField]} unit(s) available in ${input.fromChannel} stock.`,
    );
  }

  inv[fromField] -= qty;
  inv[toField] += qty;
  inv.lastUpdated = new Date().toISOString();

  await upsert("INVENTORY", [inv]);
  await appendCDC({
    timestamp: inv.lastUpdated,
    feed: "INVENTORY",
    operation: "STOCK_TRANSFER",
    integrationMethod: "CDC",
    recordKey: inv.sku,
    summary: `Transferred ${qty} unit(s) of ${inv.sku} from ${input.fromChannel} to ${input.toChannel}`,
    latencyMs: 17,
  });
  await sync();
  await audit(
    role,
    "STOCK_TRANSFER",
    inv.sku,
    `Moved ${qty} unit(s) of ${inv.sku} (${inv.productName}) from ${input.fromChannel} to ${input.toChannel}.`,
    "ALLOWED",
    identity,
  );
  return inv;
}

export async function resetDemo(role: UserRole, identity?: AccessIdentity) {
  await execute("DELETE FROM retail_sources");
  await execute("DELETE FROM retail_cdc_events");
  await seedSourcesAndCDC();
  await sync();
  await audit(
    role,
    "RESET_DEMO",
    "All feeds",
    "Restored baseline retail demo dataset; append-only audit trail retained.",
    "ALLOWED",
    identity,
  );
}

export function snapshot(
  role: UserRole,
  identity?: AccessIdentity,
): Promise<RetailSnapshot> {
  return readTransaction(async () => {
    const [sourceRows, masterRows, cdcRows, runRows, trail] = await Promise.all([
      rows<{ feed: Feed; payload: string }>(
        "SELECT feed, payload FROM retail_sources ORDER BY feed, record_key",
      ),
      rows<{ id: string; payload: string }>(
        "SELECT id, payload FROM retail_master ORDER BY id",
      ),
      rows<PayloadRow>(
        "SELECT payload FROM retail_cdc_events ORDER BY seq DESC LIMIT 25",
      ),
      rows<PayloadRow>(
        "SELECT payload FROM retail_etl_runs ORDER BY seq DESC LIMIT 15",
      ),
      auditTrail(),
    ]);

    const posRecords: POSRecord[] = [];
    const inventoryRecords: InventoryRecord[] = [];
    const crmRecords: CRMRecord[] = [];
    const onlineRecords: OnlineOrderRecord[] = [];
    const logisticsRecords: LogisticsRecord[] = [];

    for (const r of sourceRows) {
      const obj = JSON.parse(r.payload);
      if (r.feed === "POS") posRecords.push(obj);
      else if (r.feed === "INVENTORY") inventoryRecords.push(obj);
      else if (r.feed === "CRM") crmRecords.push(obj);
      else if (r.feed === "ONLINE") onlineRecords.push(obj);
      else if (r.feed === "LOGISTICS") logisticsRecords.push(obj);
    }

    let stockItems: UnifiedStockItem[] = [];
    let consistencyAlerts: ConsistencyAlert[] = [];
    let salesSummary: SalesSummary = {
      totalRevenue: 0,
      posManilaRevenue: 0,
      posCebuRevenue: 0,
      onlineRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      onTimeDeliveryRate: 100,
      delayedShipments: 0,
      revenueByCategory: [],
      carrierPerformance: [],
    };
    let lastSyncedAt = new Date().toISOString();
    const customers: UnifiedCustomerRecord[] = [];

    for (const m of masterRows) {
      if (m.id === "meta:stock") stockItems = JSON.parse(m.payload);
      else if (m.id === "meta:alerts") consistencyAlerts = JSON.parse(m.payload);
      else if (m.id === "meta:sales") {
        const meta = JSON.parse(m.payload) as {
          salesSummary: SalesSummary;
          lastSyncedAt: string;
        };
        salesSummary = meta.salesSummary;
        lastSyncedAt = meta.lastSyncedAt;
      } else if (m.id.startsWith("cust:")) {
        customers.push(JSON.parse(m.payload));
      }
    }

    const cdcEvents: CDCEvent[] = cdcRows.map((r) => JSON.parse(r.payload));
    const etlReports: ETLRunReport[] = runRows.map((r) => JSON.parse(r.payload));

    const governed = applyRetailGovernance(role, identity, {
      posRecords,
      inventoryRecords,
      crmRecords,
      onlineRecords,
      logisticsRecords,
      stockItems,
      customers,
      salesSummary,
    });

    const specialist = isSpecialist(role);
    const filteredLogs = specialist ? [] : ownAuditOnly(role)
      ? trail.entries.filter((entry) =>
          identity?.mode === "account"
            ? entry.actorId === identity.userId
            : entry.userRole === role,
        )
      : trail.entries;

    return {
      accessMode: identity?.mode,
      currentRole: role,
      actorName: identity?.displayName || actors[role],
      actorId: identity?.userId,
      branchScope: governed.branchScope,
      posRecords: governed.posRecords,
      inventoryRecords: governed.inventoryRecords,
      crmRecords: governed.crmRecords,
      onlineRecords: governed.onlineRecords,
      logisticsRecords: governed.logisticsRecords,
      stockItems: governed.stockItems,
      customers: governed.customers,
      cdcEvents: specialist ? [] : cdcEvents,
      consistencyAlerts: specialist
        ? consistencyAlerts.filter((alert) => {
            if (role === "INVENTORY_STAFF") return alert.feed === "INVENTORY";
            if (role === "DELIVERY_COORDINATOR") {
              return alert.type === "DELAYED_3PL" || alert.type === "MISSING_TRACKING";
            }
            return false;
          })
        : consistencyAlerts,
      etlReports: specialist ? [] : etlReports,
      auditLogs: filteredLogs,
      sourceCounts: {
        POS: specialist ? 0 : posRecords.length,
        INVENTORY: specialist ? governed.inventoryRecords.length : inventoryRecords.length,
        CRM: specialist ? 0 : crmRecords.length,
        ONLINE: specialist ? 0 : onlineRecords.length,
        LOGISTICS: specialist ? governed.logisticsRecords.length : logisticsRecords.length,
      },
      salesSummary: governed.salesSummary,
      auditIntegrity: !specialist && trail.valid,
      lastSyncedAt,
    };
  });
}

export function toShopperSummary(c: UnifiedCustomerRecord): ShopperSummary {
  return {
    customerId: c.customerId,
    fullName: c.fullName,
    loyaltyTier: c.loyaltyTier,
    pointsBalance: c.pointsBalance,
    favoriteCategory: c.favoriteCategory,
    gdprConsent: c.gdprConsent,
    personalizedOffer: c.personalizedOffer,
  };
}

export function shopCatalog(): Promise<ShopSnapshot> {
  return readTransaction(async () => {
    const masterRows = await rows<{ id: string; payload: string }>(
      "SELECT id, payload FROM retail_master ORDER BY id",
    );
    let products: ShopProduct[] = [];
    let lastSyncedAt = new Date().toISOString();
    const shoppers: ShopperSummary[] = [];

    for (const m of masterRows) {
      if (m.id === "meta:stock") {
        const stock = JSON.parse(m.payload) as UnifiedStockItem[];
        products = stock.map(({
          sku, productName, category, unitPrice, warehouseStock, unitsSoldOnline,
          brand, rating, discountPercentage, description, thumbnail, images,
        }) => ({
          sku, productName, category, unitPrice, warehouseStock, unitsSoldOnline,
          brand, rating, discountPercentage, description, thumbnail, images,
        }));
      } else if (m.id === "meta:sales") {
        const meta = JSON.parse(m.payload) as { lastSyncedAt: string };
        lastSyncedAt = meta.lastSyncedAt;
      } else if (m.id.startsWith("cust:")) {
        shoppers.push(toShopperSummary(JSON.parse(m.payload) as UnifiedCustomerRecord));
      }
    }

    return { products, shoppers, lastSyncedAt };
  });
}
