import { z } from "zod";
import Papa from "papaparse";
import type { Feed } from "@/shared/types";
import { BRANCHES, CARRIERS, CATEGORIES } from "@/shared/retail";

const text = z.string().trim().min(1).max(200);
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(200).optional(),
);
const keyId = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
  z
    .string()
    .regex(
      /^[A-Za-z0-9_-]{1,60}$/,
      "Use letters, numbers, underscores or hyphens",
    ),
);
const number = (max: number, integer = false, min = 0) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    integer
      ? z.number().int().min(min).max(max)
      : z.number().min(min).max(max),
  );

function normalizeIsoDate(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  const slashYmd = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (slashYmd) {
    return `${slashYmd[1]}-${slashYmd[2].padStart(2, "0")}-${slashYmd[3].padStart(2, "0")}`;
  }
  const slashMdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMdy) {
    return `${slashMdy[3]}-${slashMdy[1].padStart(2, "0")}-${slashMdy[2].padStart(2, "0")}`;
  }
  return trimmed;
}

const isoDate = z.preprocess(
  normalizeIsoDate,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format")
    .refine(
      (v) =>
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "Enter a valid calendar date as YYYY-MM-DD",
    ),
);

const timestampOrDate = z
  .string()
  .trim()
  .min(10)
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date/timestamp");

const branchEnum = z.preprocess(
  (v) =>
    typeof v === "string"
      ? v.trim().charAt(0).toUpperCase() + v.trim().slice(1).toLowerCase()
      : v,
  z.enum(BRANCHES, { error: "Choose Manila or Cebu" }),
);

export const schemas = {
  POS: z
    .object({
      txId: keyId,
      branch: branchEnum,
      customerId: keyId,
      sku: keyId,
      productName: text,
      quantity: number(1000, true, 1),
      unitPrice: number(1_000_000, false, 1),
      totalAmount: number(10_000_000, false, 1),
      paymentMethod: z.enum(["Card", "Cash", "GCash"]),
      cardNumber: text,
      timestamp: timestampOrDate,
    })
    .strict(),
  INVENTORY: z
    .object({
      sku: keyId,
      productName: text,
      category: z.enum(CATEGORIES),
      unitPrice: number(1_000_000, false, 1),
      manilaStock: number(100_000, true, -1000),
      cebuStock: number(100_000, true, -1000),
      warehouseStock: number(100_000, true, -1000),
      reorderPoint: number(10_000, true, 0),
      lastUpdated: timestampOrDate,
      externalId: number(1_000_000, true, 1).optional(),
      externalSku: optionalText,
      brand: optionalText,
      rating: number(5, false, 0).optional(),
      discountPercentage: number(100, false, 0).optional(),
      description: z.string().trim().max(1500).optional(),
      thumbnail: z.string().trim().max(500).optional(),
      images: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
    })
    .strict(),
  CRM: z
    .object({
      customerId: keyId,
      fullName: text,
      email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
      phone: text,
      loyaltyTier: z.enum(["VIP", "Gold", "Silver", "Bronze"]),
      pointsBalance: number(1_000_000, true, 0),
      preferredBranch: branchEnum,
      gdprConsent: z.enum(["Opted In", "Opted Out"]),
      favoriteCategory: z.enum(CATEGORIES),
      joinedAt: isoDate,
    })
    .strict(),
  ONLINE: z
    .object({
      orderId: keyId,
      customerId: keyId,
      sku: keyId,
      productName: text,
      quantity: number(1000, true, 1),
      totalAmount: number(10_000_000, false, 1),
      paymentMethod: z.enum(["Card", "GCash", "Maya"]),
      cardNumber: text,
      promoCode: text,
      orderStatus: z.enum(["Processing", "Shipped", "Delivered"]),
      orderedAt: timestampOrDate,
    })
    .strict(),
  LOGISTICS: z
    .object({
      shipmentId: keyId,
      orderId: keyId,
      customerId: keyId,
      carrier: z.enum(CARRIERS),
      trackingNumber: keyId,
      status: z.enum([
        "Label Created",
        "In Transit",
        "Out for Delivery",
        "Delivered",
        "Delayed",
      ]),
      estimatedDelivery: isoDate,
      delayReason: optionalText,
      updatedAt: timestampOrDate,
    })
    .strict(),
};

export type ValidatedFeedRow<F extends Feed> = z.infer<(typeof schemas)[F]>;

export function parseImport<F extends Feed>(
  feed: F,
  content: string,
  format: "csv" | "json",
): Array<ValidatedFeedRow<F>> {
  let rows: unknown;
  if (format === "json") {
    try {
      rows = JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON. Upload an array of records.");
    }
  } else {
    const result = Papa.parse(content.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    if (result.errors.length) {
      throw new Error(`CSV could not be parsed: ${result.errors[0].message}`);
    }
    rows = result.data;
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) {
    throw new Error("Upload between 1 and 1,000 records.");
  }
  return rows.map((row, i) => {
    const result = schemas[feed].safeParse(row);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(
        `Row ${i + 1}, ${issue.path.join(".") || "record"}: ${issue.message}. No records were imported.`,
      );
    }
    return result.data as ValidatedFeedRow<F>;
  });
}
