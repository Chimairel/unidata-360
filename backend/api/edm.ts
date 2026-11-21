import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { accountsRequired } from "@/backend/auth";
import {
  AuthenticationRequired,
  checkOrigin,
  session,
} from "@/backend/session";
import {
  actors,
  appendCDC,
  audit,
  createCustomer,
  customerById,
  dispatchOnlineOrder,
  execute,
  importCatalogProduct,
  processCheckout,
  recordPOSSale,
  resetDemo,
  restockSKU,
  simulateSeasonalSpike,
  snapshot,
  sync,
  toggleGDPRConsent,
  transaction,
  transferStock,
  updateShipmentStatus,
  upsert,
} from "@/backend/store";
import { parseImport } from "@/backend/validation";
import {
  branchScope,
  canManageDeliveries,
  canManageInventory,
  canManageOps,
  canRecordPOSSale,
  canToggleGDPR,
  isAssignedCashierSale,
  isSpecialist,
} from "@/shared/access";
import {
  BRANCHES,
  CARRIERS,
  CATEGORIES,
  RETAIL_ROLES,
  WEBSITE_ORDER_DEMO,
} from "@/shared/retail";
import type { CheckoutReceipt, UserRole } from "@/shared/types";

const command = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("role"),
    role: z.enum(RETAIL_ROLES),
  }),
  z.object({ type: z.literal("sync") }),
  z.object({ type: z.literal("reset") }),
  z.object({
    type: z.literal("import"),
    feed: z.enum(["POS", "INVENTORY", "CRM", "ONLINE", "LOGISTICS"]),
    format: z.enum(["csv", "json"]),
    content: z.string().max(2_000_000),
  }),
  z.object({
    type: z.literal("pos_sale"),
    branch: z.enum(BRANCHES),
    sku: z.string().min(1).max(60),
    customerId: z.string().max(60),
    quantity: z.number().int().min(1).max(50),
    paymentMethod: z.enum(["Card", "Cash", "GCash"]),
  }),
  z.strictObject({ type: z.literal("simulate_website_order") }),
  z.object({ type: z.literal("seasonal_spike") }),
  z.object({
    type: z.literal("restock"),
    sku: z.string().min(1).max(60),
    amount: z.number().int().min(1).max(500).optional(),
  }),
  z.object({
    type: z.literal("toggle_gdpr"),
    customerId: z.string().min(1).max(60),
  }),
  z.object({
    type: z.literal("import_catalog_product"),
    productId: z.number().int().min(1).max(1000),
  }),
  z.strictObject({
    type: z.literal("checkout"),
    channel: z.literal("POS"),
    branch: z.enum(BRANCHES).optional(),
    customerId: z.string().max(60),
    paymentMethod: z.enum(["Card", "Cash", "GCash"]),
    cardNumber: z.string().max(30).optional(),
    items: z
      .array(
        z.object({
          sku: z.string().min(1).max(60),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({
    type: z.literal("create_customer"),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
    phone: z.string().trim().min(5).max(40),
    preferredBranch: z.enum(BRANCHES),
    favoriteCategory: z.enum(CATEGORIES),
    loyaltyTier: z.enum(["VIP", "Gold", "Silver", "Bronze"]),
    gdprConsent: z.enum(["Opted In", "Opted Out"]),
  }),
  z.object({
    type: z.literal("dispatch_order"),
    orderId: z.string().min(1).max(60),
    carrier: z.enum(CARRIERS),
  }),
  z.object({
    type: z.literal("update_shipment"),
    shipmentId: z.string().min(1).max(60),
    status: z.enum([
      "Label Created",
      "In Transit",
      "Out for Delivery",
      "Delivered",
      "Delayed",
    ]),
    delayReason: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal("transfer_stock"),
    sku: z.string().min(1).max(60),
    fromChannel: z.enum(["Manila", "Cebu", "Online"]),
    toChannel: z.enum(["Manila", "Cebu", "Online"]),
    quantity: z.number().int().min(1).max(500),
  }),
  z.object({
    type: z.literal("view"),
    customerId: z.string().min(1).max(60),
  }),
]);

const commandPermission: Record<
  z.infer<typeof command>["type"],
  (role: UserRole) => boolean
> = {
  role: (role) => !isSpecialist(role),
  view: (role) => !isSpecialist(role),
  sync: canManageOps,
  reset: canManageOps,
  import: canManageOps,
  simulate_website_order: canManageOps,
  seasonal_spike: canManageOps,
  import_catalog_product: canManageOps,
  pos_sale: (role) => canRecordPOSSale(role) && role !== "CASHIER",
  checkout: canRecordPOSSale,
  restock: canManageInventory,
  transfer_stock: canManageInventory,
  dispatch_order: canManageDeliveries,
  update_shipment: canManageDeliveries,
  create_customer: canToggleGDPR,
  toggle_gdpr: canToggleGDPR,
};

export async function GET() {
  try {
    const s = await session();
    return Response.json(await snapshot(s.role, s), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired) {
      return Response.json(
        { error: e.message },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(e);
    return Response.json(
      {
        error:
          "The database could not be reached. Check server logs and try again.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 2_100_000) {
      return Response.json(
        { error: "File too large. Maximum size is 2 MB." },
        { status: 413 },
      );
    }
    const raw = await request.text();
    if (raw.length > 2_100_000) {
      return Response.json(
        { error: "File too large. Maximum size is 2 MB." },
        { status: 413 },
      );
    }
    const parsed = command.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request payload. Check fields and try again." },
        { status: 400 },
      );
    }

    const cmd = parsed.data;
    let s = await session();
    let role: UserRole = s.role;
    let message = "Saved";
    let receipt: CheckoutReceipt | undefined;

    const outsideCashierScope =
      role === "CASHIER" &&
      cmd.type === "checkout" &&
      !isAssignedCashierSale(s, cmd.branch, cmd.customerId);

    if (!commandPermission[cmd.type](role) || outsideCashierScope) {
      await audit(
        role,
        "ACCESS_DENIED",
        cmd.type,
        "Server denied a command outside this role's permissions.",
        "RESTRICTED_MASKED",
        s,
      );
      return Response.json(
        { error: "This action requires a permitted retail role." },
        { status: 403 },
      );
    }

    if (cmd.type === "view") {
      const cust = await customerById(cmd.customerId);
      const scope = branchScope(role, s);
      if (
        !cust ||
        (scope &&
          cust.preferredBranch !== scope &&
          !cust.posTransactions.some((p) => p.branch === scope))
      ) {
        return Response.json(
          { error: "Customer record unavailable to this role." },
          { status: 404 },
        );
      }
      const auditEntry = await audit(
        role,
        "READ_CUSTOMER_360",
        cust.customerId,
        "Viewed Customer 360 profile with server-applied PCI DSS & GDPR permissions.",
        "ALLOWED",
        s,
      );
      return Response.json(
        { ok: true, auditEntry, message },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (cmd.type === "role") {
      if (accountsRequired() && s.mode === "account") {
        await audit(
          role,
          "ACCESS_DENIED",
          "Account role",
          "Denied role switching for an authenticated account.",
          "RESTRICTED_MASKED",
          s,
        );
        return Response.json(
          {
            error:
              "Your role is bound to your signed-in account. Sign out to switch roles.",
          },
          { status: 403 },
        );
      }
      await transaction(async () => {
        await execute(
          "UPDATE retail_sessions SET role=?, user_id=NULL WHERE id=?",
          cmd.role,
          s.id,
        );
        await audit(
          cmd.role,
          "ROLE_SWITCH",
          "Demo role",
          `Switched role to ${actors[cmd.role]}.`,
        );
      });
      s = {
        ...s,
        mode: "demo",
        userId: undefined,
        displayName: undefined,
        branch: cmd.role === "BRANCH_MANAGER" ? "Manila" : undefined,
      };
      role = cmd.role;
      message = `Now viewing as ${actors[cmd.role]}. Server governance policies applied.`;
    } else if (cmd.type === "sync") {
      await transaction(async () => {
        const report = await sync();
        await audit(
          role,
          "INTEGRATION_SYNC",
          report.id,
          `Reconciled 5 feeds into ${report.recordsLoaded} master views (${report.anomaliesDetected} alerts).`,
          "ALLOWED",
          s,
        );
      });
      message =
        "All 5 feeds synchronized across Stock Sync, Customer 360 & Analytics.";
    } else if (cmd.type === "reset") {
      await transaction(() => resetDemo(role, s));
      message = "Baseline retail demo dataset restored. Audit chain retained.";
    } else if (cmd.type === "import") {
      const rows = parseImport(cmd.feed, cmd.content, cmd.format);
      await transaction(async () => {
        const result = await upsert(cmd.feed, rows);
        const now = new Date().toISOString();
        await appendCDC({
          timestamp: now,
          feed: cmd.feed,
          operation: "BATCH_IMPORT",
          integrationMethod: "Virtualization",
          recordKey: `${cmd.feed} (${rows.length})`,
          summary: `Imported ${rows.length} ${cmd.feed} row(s) (${result.inserted} new, ${result.updated} updated)`,
          latencyMs: 32,
        });
        await sync();
        message = `${result.inserted} inserted, ${result.updated} updated into ${cmd.feed}; master views synced.`;
        await audit(role, "IMPORT_FEED", cmd.feed, message, "ALLOWED", s);
      });
    } else if (cmd.type === "pos_sale") {
      await transaction(() => recordPOSSale(role, s, cmd));
      message = `POS sale synced (${cmd.sku} × ${cmd.quantity}) & channel stock updated.`;
    } else if (cmd.type === "simulate_website_order") {
      const { customerId, sku, quantity, carrier, paymentMethod } =
        WEBSITE_ORDER_DEMO;
      await transaction(() =>
        processCheckout(role, s, {
          channel: "ONLINE",
          customerId,
          carrier,
          paymentMethod,
          simulated: true,
          items: [{ sku, quantity }],
        }),
      );
      message = `Simulated a website order and created a sample ${carrier} shipment.`;
    } else if (cmd.type === "seasonal_spike") {
      await transaction(() => simulateSeasonalSpike(role, s));
      message =
        "11.11 Flash Sale burst simulated: 6 orders synced, oversell & 3PL delay flagged.";
    } else if (cmd.type === "restock") {
      await transaction(() => restockSKU(role, s, cmd.sku, cmd.amount ?? 20));
      message = `Replenished ${cmd.sku.toUpperCase()} across Manila, Cebu, and Online.`;
    } else if (cmd.type === "import_catalog_product") {
      let importedSku = "";
      let importedName = "";
      await transaction(async () => {
        const record = await importCatalogProduct(role, s, cmd.productId);
        importedSku = record.sku;
        importedName = record.productName;
      });
      message = `Synced "${importedName}" (${importedSku}) from DummyJSON Catalog API into all channels.`;
    } else if (cmd.type === "checkout") {
      receipt = await transaction(() => processCheckout(role, s, cmd));
      message = `${receipt.branch} POS checkout completed (₱${receipt.totalAmount.toLocaleString()}).`;
    } else if (cmd.type === "create_customer") {
      await transaction(async () => {
        const created = await createCustomer(role, s, cmd);
        message = `Registered ${created.fullName} (${created.customerId}, ${created.loyaltyTier}) in CRM.`;
      });
    } else if (cmd.type === "dispatch_order") {
      await transaction(async () => {
        const shipment = await dispatchOnlineOrder(
          role,
          s,
          cmd.orderId,
          cmd.carrier,
        );
        message = `Dispatched ${cmd.orderId} via ${shipment.carrier} (${shipment.trackingNumber}).`;
      });
    } else if (cmd.type === "update_shipment") {
      await transaction(async () => {
        const shipment = await updateShipmentStatus(
          role,
          s,
          cmd.shipmentId,
          cmd.status,
          cmd.delayReason,
        );
        message = `${shipment.shipmentId} (${shipment.carrier}) updated to ${shipment.status}.`;
      });
    } else if (cmd.type === "transfer_stock") {
      await transaction(async () => {
        const inv = await transferStock(role, s, cmd);
        message = `Transferred ${cmd.quantity} unit(s) of ${inv.sku} from ${cmd.fromChannel} to ${cmd.toChannel}.`;
      });
    } else if (cmd.type === "toggle_gdpr") {
      let nextConsent = "Opted In";
      await transaction(async () => {
        nextConsent = await toggleGDPRConsent(role, s, cmd.customerId);
      });
      message = `GDPR preference updated to ${nextConsent} (${nextConsent === "Opted Out" ? "offers suppressed" : "offers active"}).`;
    }

    return Response.json(
      {
        snapshot: await snapshot(role, s),
        message,
        ...(receipt ? { receipt } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired) {
      return Response.json(
        { error: e.message },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { error: e instanceof Error ? e.message : "Request failed. Try again." },
      { status: 400 },
    );
  }
}
