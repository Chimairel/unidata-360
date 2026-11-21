import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  initialCRMRecords,
  initialInventoryRecords,
  initialLogisticsRecords,
  initialOnlineRecords,
  initialPOSRecords,
} from "../backend/data/mockData";
import { runRetailIntegration } from "../backend/etl/pipeline";
import { applyRetailGovernance, maskPaymentCard } from "../backend/governance/masking";
import { parseImport } from "../backend/validation";
import {
  computeOfferDiscount,
  toShopperSummary,
  verifyAuditRows,
  type AuditChainRow,
} from "../backend/store";
import { accountsRequired } from "../backend/auth";
import { POST as staffCommand } from "../backend/api/edm";
import { buildQualityRows } from "../frontend/lib/dataQuality";
import { defaultWorkspaceTab, effectiveWorkspaceTab, workspaceTabs } from "../frontend/lib/workspaceAccess";
import {
  buildQuickCashAmounts,
  convertUsdToPhp,
  mapDummyJsonCategory,
} from "../shared/retail";
import {
  branchScope,
  canManageDeliveries,
  canManageInventory,
  canManageOps,
  canRecordPOSSale,
  canToggleGDPR,
  canViewAnalytics,
  isAssignedCashierSale,
  ownAuditOnly,
} from "../shared/access";

test("staff commands reject manually entered delivery orders", async () => {
  const origin = process.env.EDM_PUBLIC_ORIGIN || "http://localhost:3005";
  const items = [{ sku: "SKU-102", quantity: 1 }];
  const delivery = {
    customerId: "CUST-002",
    paymentMethod: "Card",
    carrier: "LBC Express",
  };
  const commands = [
    { type: "checkout", channel: "ONLINE", ...delivery, items },
    { type: "checkout", channel: "POS", branch: "Cebu", ...delivery, items },
    { type: "online_order", ...delivery, ...items[0] },
    { type: "simulate_website_order", ...delivery, items },
  ];

  for (const command of commands) {
    const response = await staffCommand(
      new Request(`${origin}/api/edm`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(command),
      }),
    );
    assert.equal(response.status, 400, JSON.stringify(command));
    assert.match((await response.json()).error, /^Invalid request payload/);
  }
});

test("5-source retail integration reconciles stock, offers, sales summary, and consistency alerts", () => {
  const result = runRetailIntegration(
    initialPOSRecords,
    initialInventoryRecords,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );

  assert.equal(result.stockItems.length, 6);
  assert.equal(result.customers.length, 6);
  assert.equal(result.report.recordsExtracted.POS, 6);
  assert.equal(result.report.recordsExtracted.INVENTORY, 6);
  assert.equal(result.report.recordsExtracted.CRM, 6);
  assert.equal(result.report.recordsExtracted.ONLINE, 6);
  assert.equal(result.report.recordsExtracted.LOGISTICS, 5);

  const lowStockItem = result.stockItems.find((s) => s.sku === "SKU-103");
  assert.equal(lowStockItem?.stockStatus, "Low Stock");

  const syncedItem = result.stockItems.find((s) => s.sku === "SKU-101");
  assert.equal(syncedItem?.stockStatus, "Synced");

  assert.ok(
    result.consistencyAlerts.some((a) => a.type === "DELAYED_3PL"),
    "Should detect delayed J&T shipment",
  );
  assert.ok(
    result.consistencyAlerts.some(
      (a) => a.type === "MISSING_TRACKING" && a.referenceKey === "ORD-5006",
    ),
    "Should detect ORD-5006 without 3PL tracking",
  );
  assert.ok(
    result.consistencyAlerts.some(
      (a) => a.type === "UNLINKED_POS_CUSTOMER" && a.referenceKey === "POS-1006",
    ),
    "Should detect unlinked WALKIN-01 POS transaction",
  );
});

test("Stock Sync flags Oversell Risk when warehouse stock drops below zero during spike", () => {
  const spikedInventory = initialInventoryRecords.map((item) =>
    item.sku === "SKU-103" ? { ...item, warehouseStock: -3 } : item,
  );
  const result = runRetailIntegration(
    initialPOSRecords,
    spikedInventory,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );

  const oversellItem = result.stockItems.find((s) => s.sku === "SKU-103");
  assert.equal(oversellItem?.stockStatus, "Oversell Risk");
  assert.ok(
    result.consistencyAlerts.some(
      (a) =>
        a.type === "CHANNEL_OVERSELL" &&
        a.severity === "Critical" &&
        a.referenceKey === "SKU-103",
    ),
  );
});

test("quality view connects feed warnings to the right record and checks invalid values", () => {
  const { consistencyAlerts } = runRetailIntegration(
    initialPOSRecords,
    initialInventoryRecords,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );
  const rows = buildQualityRows({
    posRecords: initialPOSRecords,
    inventoryRecords: initialInventoryRecords,
    crmRecords: initialCRMRecords,
    onlineRecords: initialOnlineRecords.map((order) =>
      order.orderId === "ORD-5006" ? { ...order, quantity: 0 } : order,
    ),
    logisticsRecords: initialLogisticsRecords,
    consistencyAlerts,
  });
  const missing = rows.find((row) => row.key === "ONLINE:ORD-5006");
  assert.equal(missing?.status, "critical");
  assert.equal(missing.fields["Shipment record"], "Missing");
  assert.ok(missing.issues.some((issue) =>
    issue.dimension === "Completeness" && issue.field === "Shipment record",
  ));
  assert.ok(missing.issues.some((issue) =>
    issue.dimension === "Validity" && issue.field === "Quantity",
  ));
  const walkIn = rows.find((row) => row.key === "POS:POS-1006");
  assert.ok(walkIn);
  assert.equal(walkIn.issues.some((issue) => issue.field === "Customer"), false);
  assert.equal(Object.hasOwn(missing.fields, "cardNumber"), false);
  assert.ok(workspaceTabs("OPS_MANAGER").includes("quality"));
  assert.equal(workspaceTabs("COMPLIANCE_AUDITOR").includes("quality"), false);
});

test("Personalized Offer engine activates for Opted In and suppresses for Opted Out customers", () => {
  const result = runRetailIntegration(
    initialPOSRecords,
    initialInventoryRecords,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );

  const optedInVip = result.customers.find((c) => c.customerId === "CUST-001");
  assert.equal(optedInVip?.personalizedOffer.status, "Active");
  assert.match(optedInVip?.personalizedOffer.title || "", /20% Off/i);

  const optedOutVip = result.customers.find((c) => c.customerId === "CUST-003");
  assert.equal(optedOutVip?.personalizedOffer.status, "Suppressed (GDPR Opt-Out)");
  assert.equal(optedOutVip?.personalizedOffer.offerCode, "SUPPRESSED");
});

test("PCI DSS masking never exposes raw 16-digit PANs across any role", () => {
  assert.equal(maskPaymentCard("4532-8910-4421-4242", "OPS_MANAGER"), "•••• •••• •••• 4242");
  assert.equal(maskPaymentCard("4532-8910-4421-4242", "BRANCH_MANAGER"), "•••• •••• •••• 4242");
  assert.equal(maskPaymentCard("4532-8910-4421-4242", "MARKETING_CRM"), "[PCI DSS Restricted]");
  assert.equal(maskPaymentCard("4532-8910-4421-4242", "COMPLIANCE_AUDITOR"), "[PCI DSS Masked]");
  assert.equal(maskPaymentCard("N/A", "OPS_MANAGER"), "Cash / E-Wallet");

  const integrated = runRetailIntegration(
    initialPOSRecords,
    initialInventoryRecords,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );

  const roles = [
    "OPS_MANAGER",
    "MARKETING_CRM",
    "BRANCH_MANAGER",
    "COMPLIANCE_AUDITOR",
  ] as const;

  for (const role of roles) {
    const governed = applyRetailGovernance(
      role,
      role === "BRANCH_MANAGER" ? { mode: "demo", branch: "Manila" } : { mode: "demo" },
      {
        posRecords: initialPOSRecords,
        inventoryRecords: initialInventoryRecords,
        crmRecords: initialCRMRecords,
        onlineRecords: initialOnlineRecords,
        logisticsRecords: initialLogisticsRecords,
        stockItems: integrated.stockItems,
        customers: integrated.customers,
        salesSummary: integrated.salesSummary,
      },
    );
    const serialized = JSON.stringify(governed);
    assert.ok(!serialized.includes("4532-8910-4421-4242"), `Raw Visa leaked for ${role}`);
    assert.ok(!serialized.includes("5412-7512-3456-9811"), `Raw MC leaked for ${role}`);
  }
});

test("Role governance isolates Manila Branch Manager, masks Marketing opt-outs, and pseudonymizes Auditor", () => {
  const integrated = runRetailIntegration(
    initialPOSRecords,
    initialInventoryRecords,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );
  const baseData = {
    posRecords: initialPOSRecords,
    inventoryRecords: initialInventoryRecords,
    crmRecords: initialCRMRecords,
    onlineRecords: initialOnlineRecords,
    logisticsRecords: initialLogisticsRecords,
    stockItems: integrated.stockItems,
    customers: integrated.customers,
    salesSummary: integrated.salesSummary,
  };

  const mkt = applyRetailGovernance("MARKETING_CRM", { mode: "demo" }, baseData);
  const mktOptedOut = mkt.customers.find((c) => c.customerId === "CUST-003");
  assert.equal(mktOptedOut?.email, "[GDPR Opted Out]");
  assert.equal(mktOptedOut?.maskedCardOnFile, "[PCI DSS Restricted]");
  const mktOptedIn = mkt.customers.find((c) => c.customerId === "CUST-001");
  assert.equal(mktOptedIn?.email, "clara.santos@gmail.com");

  const branch = applyRetailGovernance(
    "BRANCH_MANAGER",
    { mode: "account", branch: "Manila" },
    baseData,
  );
  assert.equal(branch.branchScope, "Manila");
  assert.ok(branch.posRecords.every((p) => p.branch === "Manila"));
  assert.equal(branch.salesSummary.posCebuRevenue, 0);
  assert.equal(branch.salesSummary.onlineRevenue, 0);
  assert.ok(branch.customers.every((c) => c.email === "[GDPR Masked]"));

  const auditor = applyRetailGovernance(
    "COMPLIANCE_AUDITOR",
    { mode: "demo" },
    baseData,
  );
  assert.ok(auditor.customers.every((c) => /^Customer #\d{2}$/.test(c.fullName)));
  assert.ok(auditor.customers.every((c) => c.email === "[GDPR Masked]"));
  assert.ok(auditor.posRecords.every((p) => p.cardNumber === "[PCI DSS Masked]" || p.cardNumber === "Cash / E-Wallet"));
});

test("specialist snapshots expose only task data", () => {
  const integrated = runRetailIntegration(
    initialPOSRecords, initialInventoryRecords, initialCRMRecords,
    initialOnlineRecords, initialLogisticsRecords,
  );
  const data = {
    posRecords: initialPOSRecords,
    inventoryRecords: initialInventoryRecords,
    crmRecords: initialCRMRecords,
    onlineRecords: initialOnlineRecords,
    logisticsRecords: initialLogisticsRecords,
    stockItems: integrated.stockItems,
    customers: integrated.customers,
    salesSummary: integrated.salesSummary,
  };
  const cashier = applyRetailGovernance("CASHIER", { mode: "account", branch: "Cebu" }, data);
  assert.equal(cashier.branchScope, "Cebu");
  assert.equal(cashier.stockItems[0].cebuStock, data.stockItems[0].cebuStock);
  assert.equal(cashier.stockItems[0].manilaStock, 0);
  assert.equal(cashier.stockItems[0].warehouseStock, 0);
  assert.equal(cashier.stockItems[0].totalStock, cashier.stockItems[0].cebuStock);
  assert.deepEqual(applyRetailGovernance("CASHIER", undefined, data).stockItems, []);

  const inventory = applyRetailGovernance("INVENTORY_STAFF", undefined, data);
  assert.deepEqual(inventory.inventoryRecords, data.inventoryRecords);
  assert.equal(inventory.stockItems[0].revenueTotal, 0);
  assert.deepEqual(inventory.logisticsRecords, []);

  const delivery = applyRetailGovernance("DELIVERY_COORDINATOR", undefined, data);
  assert.deepEqual(delivery.logisticsRecords, data.logisticsRecords);
  assert.deepEqual(delivery.stockItems, []);
  assert.equal(delivery.salesSummary.delayedShipments, data.salesSummary.delayedShipments);

  for (const specialist of [cashier, inventory, delivery]) {
    assert.deepEqual(specialist.customers, []);
    assert.deepEqual(specialist.crmRecords, []);
    assert.deepEqual(specialist.onlineRecords, []);
    assert.deepEqual(specialist.posRecords, []);
    assert.equal(specialist.salesSummary.totalRevenue, 0);
  }
});

test("CSV and JSON validation accepts valid 5-feed imports and rejects bad rows", () => {
  const posCsv = [
    "txId,branch,customerId,sku,productName,quantity,unitPrice,totalAmount,paymentMethod,cardNumber,timestamp",
    "POS-8801,manila,cust-001,sku-101,Apple Airpods,1,7280,7280,Card,4532-8910-4421-4242,2026-11-20T09:00:00Z",
  ].join("\n");
  const posParsed = parseImport("POS", posCsv, "csv");
  assert.equal(posParsed[0].branch, "Manila");
  assert.equal(posParsed[0].sku, "SKU-101");

  const crmJson = JSON.stringify([
    {
      customerId: "CUST-901",
      fullName: "Nadia Reyes",
      email: "NADIA.REYES@GMAIL.COM",
      phone: "+63 917 555 0909",
      loyaltyTier: "Gold",
      pointsBalance: 1500,
      preferredBranch: "Cebu",
      gdprConsent: "Opted Out",
      favoriteCategory: "Electronics",
      joinedAt: "2025/09/15",
    },
  ]);
  const crmParsed = parseImport("CRM", crmJson, "json");
  assert.equal(crmParsed[0].email, "nadia.reyes@gmail.com");
  assert.equal(crmParsed[0].joinedAt, "2025-09-15");

  assert.throws(() =>
    parseImport(
      "CRM",
      JSON.stringify([
        {
          customerId: "CUST-BAD",
          fullName: "Test User",
          email: "bad@gmail.com",
          phone: "123",
          loyaltyTier: "VIP",
          pointsBalance: 10,
          preferredBranch: "Davao",
          gdprConsent: "Opted In",
          favoriteCategory: "Electronics",
          joinedAt: "2026-01-01",
        },
      ]),
      "json",
    ),
  );
});

test("SHA-256 audit hash chain verifies valid entries and catches tampering", () => {
  const entry1 = JSON.stringify({ id: "AUD-1", action: "POS_SALE" });
  const hash1 = createHash("sha256").update("GENESIS" + entry1).digest("hex");
  const entry2 = JSON.stringify({ id: "AUD-2", action: "SEASONAL_SPIKE" });
  const hash2 = createHash("sha256").update(hash1 + entry2).digest("hex");

  const validChain: AuditChainRow[] = [
    { payload: entry1, previous_hash: "GENESIS", hash: hash1 },
    { payload: entry2, previous_hash: hash1, hash: hash2 },
  ];
  assert.equal(verifyAuditRows(validChain).valid, true);

  const tamperedChain: AuditChainRow[] = [
    {
      payload: JSON.stringify({ id: "AUD-1", action: "TAMPERED" }),
      previous_hash: "GENESIS",
      hash: hash1,
    },
    { payload: entry2, previous_hash: hash1, hash: hash2 },
  ];
  assert.equal(verifyAuditRows(tamperedChain).valid, false);
});

test("Access control helpers enforce retail role capabilities", () => {
  assert.equal(canManageOps("OPS_MANAGER"), true);
  assert.equal(canManageOps("MARKETING_CRM"), false);
  assert.equal(canRecordPOSSale("BRANCH_MANAGER"), true);
  assert.equal(canRecordPOSSale("COMPLIANCE_AUDITOR"), false);
  assert.equal(canToggleGDPR("MARKETING_CRM"), true);
  assert.equal(canToggleGDPR("BRANCH_MANAGER"), false);
  assert.equal(canViewAnalytics("COMPLIANCE_AUDITOR"), false);
  assert.equal(branchScope("BRANCH_MANAGER", { mode: "demo" }), "Manila");
  assert.equal(branchScope("OPS_MANAGER", { mode: "demo" }), undefined);
  assert.equal(ownAuditOnly("OPS_MANAGER"), false);
  assert.equal(ownAuditOnly("MARKETING_CRM"), true);
  assert.equal(canRecordPOSSale("CASHIER"), true);
  assert.equal(canRecordPOSSale("DELIVERY_COORDINATOR"), false);
  assert.equal(canManageInventory("INVENTORY_STAFF"), true);
  assert.equal(canManageInventory("CASHIER"), false);
  assert.equal(canManageDeliveries("DELIVERY_COORDINATOR"), true);
  assert.equal(canManageDeliveries("INVENTORY_STAFF"), false);
  const cebu = { mode: "account", branch: "Cebu" } as const;
  assert.equal(isAssignedCashierSale(cebu, "Cebu", "WALKIN-01"), true);
  assert.equal(isAssignedCashierSale(cebu, "Manila", "WALKIN-01"), false);
  assert.equal(isAssignedCashierSale(cebu, "Cebu", "CUST-001"), false);
  assert.equal(isAssignedCashierSale(undefined, "Cebu", "WALKIN-01"), false);
  assert.deepEqual(workspaceTabs("CASHIER"), ["checkout"]);
  assert.deepEqual(workspaceTabs("INVENTORY_STAFF"), ["stock"]);
  assert.deepEqual(workspaceTabs("DELIVERY_COORDINATOR"), ["delivery"]);
  assert.equal(defaultWorkspaceTab("OPS_MANAGER"), "stock");
  assert.equal(effectiveWorkspaceTab("CASHIER", "quality"), "checkout");
});

test("accountsRequired always enforces real account sign-in", () => {
  const prevMode = process.env.EDM_AUTH_MODE;
  delete process.env.EDM_AUTH_MODE;
  assert.equal(accountsRequired(), true);
  process.env.EDM_AUTH_MODE = "demo";
  assert.equal(accountsRequired(), true);
  process.env.EDM_AUTH_MODE = "accounts";
  assert.equal(accountsRequired(), true);
  process.env.EDM_AUTH_MODE = "strict";
  assert.equal(accountsRequired(), true);
  if (prevMode === undefined) delete process.env.EDM_AUTH_MODE;
  else process.env.EDM_AUTH_MODE = prevMode;
});

test("DummyJSON catalog helpers map categories, PHP pricing, and flagship images", () => {
  assert.equal(mapDummyJsonCategory("beauty"), "Beauty & Fragrance");
  assert.equal(mapDummyJsonCategory("fragrances"), "Beauty & Fragrance");
  assert.equal(mapDummyJsonCategory("mobile-accessories"), "Electronics");
  assert.equal(mapDummyJsonCategory("home-decoration"), "Home & Living");
  assert.equal(mapDummyJsonCategory("mens-shoes"), "Fashion");

  assert.equal(convertUsdToPhp(129.99), 7280);
  assert.equal(convertUsdToPhp(19.99), 1120);

  for (const item of initialInventoryRecords) {
    assert.ok(item.thumbnail?.startsWith("https://cdn.dummyjson.com/"));
    assert.ok((item.images?.length || 0) >= 1);
    assert.ok(Boolean(item.brand));
    assert.ok(typeof item.rating === "number" && item.rating > 0);
  }
});

test("computeOfferDiscount rewards Opted In favorite categories and suppresses Opted Out or Walk-In", () => {
  const optedInVip = initialCRMRecords.find((c) => c.customerId === "CUST-001"); // VIP, Electronics
  const optedInGold = initialCRMRecords.find((c) => c.customerId === "CUST-002"); // Gold, Home & Living
  const optedOutVip = initialCRMRecords.find((c) => c.customerId === "CUST-003"); // VIP, Opted Out

  const vipDiscount = computeOfferDiscount(optedInVip, [
    { category: "Electronics", lineTotal: 7280 },
    { category: "Beauty & Fragrance", lineTotal: 7280 },
  ]);
  assert.equal(vipDiscount.promoCode, "VIP-ELEC20");
  assert.equal(vipDiscount.discountAmount, Math.round(7280 * 0.2));

  const goldDiscount = computeOfferDiscount(optedInGold, [
    { category: "Home & Living", lineTotal: 2800 },
  ]);
  assert.equal(goldDiscount.promoCode, "GOLD-HOME15");
  assert.equal(goldDiscount.discountAmount, Math.round(2800 * 0.15));

  const suppressed = computeOfferDiscount(optedOutVip, [
    { category: "Beauty & Fragrance", lineTotal: 7280 },
  ]);
  assert.equal(suppressed.discountAmount, 0);
  assert.equal(suppressed.promoCode, "NONE");

  const walkIn = computeOfferDiscount(undefined, [
    { category: "Electronics", lineTotal: 7280 },
  ]);
  assert.equal(walkIn.discountAmount, 0);
});

test("ETL reconciliation clears alerts after 3PL dispatch, delay resolution, and channel stock transfer", () => {
  const updatedLogistics = [
    ...initialLogisticsRecords.map((l) =>
      l.status === "Delayed"
        ? { ...l, status: "Delivered" as const, delayReason: undefined }
        : l,
    ),
    {
      shipmentId: "SHP-9099",
      orderId: "ORD-5006",
      customerId: "CUST-006",
      carrier: "LBC Express" as const,
      trackingNumber: "LBC-909901",
      status: "In Transit" as const,
      estimatedDelivery: "2026-11-22",
      updatedAt: "2026-11-20T09:00:00.000Z",
    },
  ];

  // Transfer 5 units from Online to Manila on oversold scenario or top up SKU-103 cleanly
  const transferredInventory = initialInventoryRecords.map((item) =>
    item.sku === "SKU-103"
      ? {
          ...item,
          manilaStock: 6,
          cebuStock: 6,
          warehouseStock: 6,
        }
      : item,
  );

  const result = runRetailIntegration(
    initialPOSRecords,
    transferredInventory,
    initialCRMRecords,
    initialOnlineRecords,
    updatedLogistics,
  );

  assert.equal(result.salesSummary.onTimeDeliveryRate, 100);
  assert.equal(
    result.consistencyAlerts.some((a) => a.type === "MISSING_TRACKING"),
    false,
  );
  assert.equal(
    result.consistencyAlerts.some((a) => a.type === "DELAYED_3PL"),
    false,
  );
  assert.equal(
    result.stockItems.find((s) => s.sku === "SKU-103")?.stockStatus,
    "Synced",
  );
});

test("buildQuickCashAmounts generates exact total plus strictly ascending unique PHP bills", () => {
  assert.deepEqual(buildQuickCashAmounts(6944), [6944, 7000, 8000, 10000]);
  assert.deepEqual(buildQuickCashAmounts(1120), [1120, 1200, 1500, 2000]);
  const bills = buildQuickCashAmounts(7280);
  assert.equal(bills[0], 7280);
  assert.equal(new Set(bills).size, 4);
  for (let i = 1; i < bills.length; i++) {
    assert.ok(bills[i] > bills[i - 1]);
  }
});

test("toShopperSummary strips PII and payment digits while keeping GDPR consent and offer status", () => {
  const integrated = runRetailIntegration(
    initialPOSRecords,
    initialInventoryRecords,
    initialCRMRecords,
    initialOnlineRecords,
    initialLogisticsRecords,
  );
  const full = integrated.customers.find((c) => c.customerId === "CUST-001")!;
  const summary = toShopperSummary(full);
  const rawJson = JSON.stringify(summary);

  assert.equal(summary.customerId, "CUST-001");
  assert.equal(summary.fullName, full.fullName);
  assert.equal(summary.loyaltyTier, full.loyaltyTier);
  assert.equal(summary.gdprConsent, "Opted In");
  assert.equal(summary.personalizedOffer.offerCode, "VIP-ELEC20");
  assert.ok(!("email" in summary));
  assert.ok(!("phone" in summary));
  assert.ok(!("maskedCardOnFile" in summary));
  assert.ok(!("posTransactions" in summary));
  assert.ok(!("onlineOrders" in summary));
  assert.ok(!rawJson.includes(full.email));
  assert.ok(!rawJson.includes(full.phone));
  assert.ok(!rawJson.includes("4242"));
});
