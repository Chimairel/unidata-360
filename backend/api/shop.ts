import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { checkOrigin } from "@/backend/session";
import {
  processCheckout,
  shopCatalog,
  transaction,
} from "@/backend/store";
import { CARRIERS } from "@/shared/retail";

const shopCheckoutSchema = z
  .object({
    customerId: z.string().trim().min(1).max(60),
    paymentMethod: z.enum(["Card", "GCash", "Maya"]),
    cardNumber: z.string().max(30).optional(),
    carrier: z.enum(CARRIERS).default("LBC Express"),
    items: z
      .array(
        z.object({
          sku: z.string().trim().min(1).max(60),
          quantity: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();

export async function GET() {
  try {
    return Response.json(await shopCatalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return Response.json(
      { error: "Unable to load Karto Shop catalog right now." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const raw = await request.text();
    if (raw.length > 50_000) {
      return Response.json(
        { error: "Order payload is too large." },
        { status: 413 },
      );
    }
    const parsed = shopCheckoutSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid order details. Check your bag and try again." },
        { status: 400 },
      );
    }

    const body = parsed.data;
    const receipt = await transaction(() =>
      processCheckout(
        "OPS_MANAGER",
        { mode: "demo", displayName: "Online Storefront (/shop)" },
        {
          channel: "ONLINE",
          customerId: body.customerId,
          paymentMethod: body.paymentMethod,
          cardNumber: body.cardNumber,
          carrier: body.carrier,
          items: body.items,
        },
      ),
    );

    const catalog = await shopCatalog();
    return Response.json(
      {
        receipt,
        catalog,
        message: `Order placed via ${receipt.carrier} (${receipt.trackingNumber}).`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    unstable_rethrow(e);
    const msg =
      e instanceof Error ? e.message : "Unable to place order right now.";
    const status = msg.includes("Cross-origin") ? 403 : 400;
    return Response.json(
      { error: msg },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
