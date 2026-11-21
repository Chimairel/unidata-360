export const BRANCHES = ["Manila", "Cebu"] as const;
export type Branch = (typeof BRANCHES)[number];

export function isBranch(value?: string | null): value is Branch {
  return value === "Manila" || value === "Cebu";
}

export const CATEGORIES = [
  "Beauty & Fragrance",
  "Electronics",
  "Home & Living",
  "Fashion",
] as const;
export type ProductCategory = (typeof CATEGORIES)[number];

export function mapDummyJsonCategory(rawCategory: string): ProductCategory {
  const c = rawCategory.trim().toLowerCase();
  if (c === "beauty" || c === "fragrances" || c === "skin-care") {
    return "Beauty & Fragrance";
  }
  if (
    c === "laptops" ||
    c === "smartphones" ||
    c === "tablets" ||
    c === "mobile-accessories"
  ) {
    return "Electronics";
  }
  if (
    c === "furniture" ||
    c === "home-decoration" ||
    c === "kitchen-accessories" ||
    c === "groceries"
  ) {
    return "Home & Living";
  }
  return "Fashion";
}

export function convertUsdToPhp(usd: number): number {
  return Math.max(50, Math.round((usd * 56) / 10) * 10);
}

export const CARRIERS = [
  "LBC Express",
  "J&T Express",
  "GrabExpress",
  "DHL",
] as const;
export type Carrier = (typeof CARRIERS)[number];

export const DEMO_PASSWORD = "123456";

export type RetailRole =
  | "OPS_MANAGER"
  | "MARKETING_CRM"
  | "BRANCH_MANAGER"
  | "COMPLIANCE_AUDITOR";

export const DEMO_ACCOUNTS: Array<{
  email: string;
  displayName: string;
  role: RetailRole;
  branch?: Branch;
  title: string;
  badge: string;
  scopeSummary: string;
}> = [
  {
    email: "ops@karto.ph",
    displayName: "Lourdes Bautista",
    role: "OPS_MANAGER",
    title: "Store Operations Manager",
    badge: "Full Ops",
    scopeSummary: "All 5 feeds, stock sync, 11.11 spike, masked cards",
  },
  {
    email: "marketing@karto.ph",
    displayName: "Camille Reyes",
    role: "MARKETING_CRM",
    title: "Marketing & CRM",
    badge: "CRM & Offers",
    scopeSummary: "CRM offers & analytics; PCI restricted; GDPR opt-outs hidden",
  },
  {
    email: "manila@karto.ph",
    displayName: "Marco Villanueva",
    role: "BRANCH_MANAGER",
    branch: "Manila",
    title: "Branch Manager · Manila",
    badge: "Manila POS",
    scopeSummary: "Manila POS sales & stock; PII & other branches masked",
  },
  {
    email: "auditor@karto.ph",
    displayName: "Atty. Gabriel Torres",
    role: "COMPLIANCE_AUDITOR",
    title: "Compliance Auditor",
    badge: "PCI / GDPR",
    scopeSummary: "Pseudonymized customers, masked cards & SHA-256 audit chain",
  },
];

export const ROLE_LABELS: Record<RetailRole, string> = {
  OPS_MANAGER: "Store Operations Manager",
  MARKETING_CRM: "Marketing & CRM",
  BRANCH_MANAGER: "Branch Manager · Manila",
  COMPLIANCE_AUDITOR: "PCI DSS / GDPR Auditor",
};

export function formatPHP(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `₱${rounded.toLocaleString("en-PH", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPHPText(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return `PHP ${rounded.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function buildQuickCashAmounts(total: number): number[] {
  const exact = Math.max(1, Math.ceil(total));
  const bump = (step: number, val = exact) =>
    Math.ceil((val + 1) / step) * step;
  const k1 = bump(1000);
  const candidates = new Set<number>([
    exact,
    bump(100),
    bump(500),
    k1,
    bump(1000, k1),
    bump(5000),
  ]);
  const sorted = [...candidates].sort((a, b) => a - b);
  while (sorted.length < 4) {
    const last = sorted[sorted.length - 1];
    sorted.push(bump(last >= 5000 ? 1000 : 500, last));
  }
  return sorted.slice(0, 4);
}
