export const retailSourceMap = [
  {
    source: "POS Systems (Manila & Cebu)",
    owner: "Branch Cashiers & Managers",
    data: "In-store sales transactions, SKU quantities, cash/GCash/card totals",
    integration: "Real-Time API on sale + CSV/JSON upload",
    governance: "PCI DSS card last-4 tokenization; branch-scoped access",
    output: "Stock deduction, Branch sales analytics & Customer 360",
    status: "Live",
  },
  {
    source: "Inventory Management",
    owner: "Store Operations & Warehouse",
    data: "Manila, Cebu & Online warehouse counts, pricing, reorder points",
    integration: "CDC stock sync + +20 Restock API",
    governance: "Read across Ops/Branch; restock restricted to Ops/Branch",
    output: "Real-Time Stock Sync table, Low Stock & Oversell alerts",
    status: "Live",
  },
  {
    source: "Customer CRM",
    owner: "Marketing & CRM Team",
    data: "Customer profiles, loyalty tier (VIP–Bronze), points, GDPR opt-in/out",
    integration: "Virtualization + live GDPR consent API",
    governance: "GDPR PII masking & automatic offer suppression on Opted Out",
    output: "Virtualized Customer 360 & Personalized Offers",
    status: "Live",
  },
  {
    source: "Online Storefront",
    owner: "E-Commerce Web & Mobile App",
    data: "Web/App checkout orders, promo codes, tokenized card numbers",
    integration: "Real-Time Order API + seasonal spike simulator",
    governance: "PCI DSS masking ([PCI DSS Restricted] for Marketing)",
    output: "Unified Sales Analytics & Online fulfillment tracking",
    status: "Live",
  },
  {
    source: "Logistics Providers (3PL)",
    owner: "LBC Express, J&T Express, GrabExpress, DHL",
    data: "Waybills, tracking numbers, delivery statuses & delay reasons",
    integration: "CDC status webhooks + CSV/JSON import",
    governance: "Branch-scoped delivery visibility; Auditor pseudonymized",
    output: "3PL Delivery Tracker & Delay / Missing Tracking alerts",
    status: "Live",
  },
];

export const retailChallenges = [
  {
    pillar: "Integration: Real-Time APIs",
    evidence:
      "Record POS Sale, Place Online Order, +20 Restock, and GDPR Consent toggles run live against PostgreSQL.",
    status: "Live",
  },
  {
    pillar: "Integration: CDC & Virtualization",
    evidence:
      "Every mutation appends to the CDC Event Stream with ms latency while Customer 360 virtualizes cross-channel spend.",
    status: "Live",
  },
  {
    pillar: "Governance: PCI DSS & GDPR",
    evidence:
      "Zero raw 16-digit PANs leave the server; Opted-Out customers automatically suppress Personalized Offers and redact PII.",
    status: "Live",
  },
  {
    pillar: "Challenge: Seasonal Spikes (11.11)",
    evidence:
      "One-click Simulate 11.11 Seasonal Spike fires 6 burst orders, creates CDC traffic, and surfaces instant Oversell Risk.",
    status: "Live",
  },
  {
    pillar: "Challenge: 3PL & Consistency",
    evidence:
      "Flags delayed J&T hubs, missing shipment tracking on ORD-5006, and unlinked walk-in POS guests automatically.",
    status: "Live",
  },
];
