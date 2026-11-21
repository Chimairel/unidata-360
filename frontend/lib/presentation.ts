export const industryMatrix = [
  [
    "Healthcare / Labs",
    "EMR, LIS, Billing, Insurance",
    "CDC, ETL/ELT, APIs",
    "HIPAA, ISO 15189",
    "Patient 360, Compliance Reports",
  ],
  [
    "Banking & Finance",
    "Core Banking, CRM, Loan Mgmt, Mobile Apps",
    "APIs, Data Fabric, ETL",
    "Basel III, AML, Audit Trails",
    "Unified Customer Profile, Fraud Detection",
  ],
  [
    "Retail & E-Commerce",
    "POS, Inventory, CRM, Online Storefronts, Logistics",
    "Real-time APIs, CDC, Virtualization",
    "PCI DSS, GDPR",
    "Stock Sync, Personalized Offers, Sales Analytics",
  ],
  [
    "Manufacturing",
    "ERP, IoT Sensors, Supply Chain, HR",
    "IoT Streaming, ETL, APIs",
    "ISO 9001, Industry Safety Standards",
    "Predictive Maintenance, Supply Chain Optimization",
  ],
  [
    "Education / Universities",
    "SIS, LMS, HR, Library, Alumni CRM",
    "ETL/ELT, APIs, Data Fabric",
    "FERPA, GDPR",
    "Unified Student Lifecycle, Academic Analytics",
  ],
];

export const slides = [
  {
    title: "Retail & E-Commerce EDM. One omnichannel shelf.",
    intro:
      "Karto integrates in-store POS, Inventory, CRM, Online Storefronts, and 3PL Logistics into one real-time governed workspace with PCI DSS & GDPR compliance.",
    items: [
      [
        "Data sources (5 live feeds)",
        "Manila & Cebu POS terminals, multi-location Inventory, Customer CRM, Online Storefront orders, and 3PL Logistics carriers (LBC Express, J&T Express, GrabExpress, DHL).",
      ],
      [
        "Integration goals",
        "Real-time stock sync across channels, personalized customer offers, and unified omnichannel sales reporting under PCI DSS and GDPR.",
      ],
      [
        "Key challenges solved",
        "Handling seasonal flash-sale spikes (11.11), integrating third-party logistics (3PL delays & tracking), and ensuring cross-channel data consistency.",
      ],
      [
        "The live application",
        "Next.js workspace backed by persistent Neon PostgreSQL, Real-Time API + CDC event stream, Virtualized Customer 360, and a SHA-256 audit chain.",
      ],
    ],
    notes:
      "Introduce Karto ('shelf') as an omnichannel Filipino retail store (Manila POS, Cebu POS, Online Storefront) solving every point on the Retail & E-Commerce class slide.",
  },
  {
    title: "Retail & E-Commerce data integration flowchart.",
    intro:
      "5 Live Sources → Real-Time APIs, CDC & Virtualization → PCI DSS / GDPR Governance → Stock Sync, Offers & Sales Analytics.",
    items: [],
    notes:
      "Walk left to right through the diagram: all 5 sources show live PostgreSQL row counts flowing into Karto's integration hub and out to live retail outputs.",
  },
  {
    title: "Five retail sources connected in real time.",
    intro:
      "Each retail system owns its domain records while feeding Karto's unified omnichannel views.",
    items: [
      [
        "POS systems & Inventory",
        "Manila and Cebu branches record in-store checkout transactions while Inventory tracks branch stock, online warehouse buffers, and reorder thresholds.",
      ],
      [
        "Customer CRM",
        "Stores customer profiles, VIP–Bronze loyalty tiers, points balance, preferred branch, favorite category, and explicit GDPR Opted In / Opted Out consent.",
      ],
      [
        "Online Storefronts",
        "Captures web and mobile checkout orders, promo codes, tokenized card methods, and fulfillment statuses into the same master stock pool.",
      ],
      [
        "Third-Party Logistics (3PL)",
        "Consolidates tracking updates and carrier exceptions across LBC Express, J&T Express, GrabExpress, and DHL alongside every online order.",
      ],
    ],
    notes:
      "Open Sales & Privacy -> Inspect Raw Data & Batch Upload (Advanced) to inspect all 5 source tabs (POS, INVENTORY, CRM, ONLINE, LOGISTICS).",
  },
  {
    title: "Real-Time APIs, CDC & Data Virtualization.",
    intro:
      "Karto demonstrates all three integration methods from the course matrix together in one workflow.",
    items: [
      [
        "Real-Time APIs",
        "In-store POS checkouts, online orders, +20 SKU restocks, and GDPR preference updates call transactional API routes and immediately update channel stock.",
      ],
      [
        "Change Data Capture (CDC)",
        "Every stock decrement, flash-sale burst, consent change, and 3PL status event writes to an append-only CDC event stream with latency metrics.",
      ],
      [
        "Data Virtualization",
        "Customer 360 cards and Stock Sync status combine live transactional feeds on the fly without duplicating or exposing raw payment card numbers.",
      ],
      [
        "Batch feed ingestion",
        "Store Operations can also upload CSV or JSON batches up to 1,000 rows into any of the 5 feeds with strict schema validation.",
      ],
    ],
    notes:
      "Click a scenario on Live Flow to watch Column 2 (Integration) update in real time with new CDC events.",
  },
  {
    title: "Handling seasonal spikes, 3PL & cross-channel consistency.",
    intro:
      "Operational retail challenges are surfaced automatically across every view.",
    items: [
      [
        "11.11 Seasonal Spike simulation",
        "A single click fires 6 concurrent POS and Online flash-sale orders, immediately revealing stock exhaustion and Oversell Risk on hot SKUs.",
      ],
      [
        "Third-Party Logistics (3PL) visibility",
        "Delayed shipments (e.g., Cebu hub congestion) and orders missing 3PL tracking numbers surface automatically under Stock & Delivery.",
      ],
      [
        "Cross-channel data consistency",
        "Monitors channel oversells, low stock, 3PL delays, missing tracking, and unlinked walk-in POS guests continuously.",
      ],
      [
        "One-click recovery",
        "Clicking +20 Restock or Reset Demo immediately resolves oversell alerts via Real-Time API + CDC replenishment.",
      ],
    ],
    notes:
      "Demonstrate clicking 3. 11.11 Flash Sale Spike on Live Flow or 11.11 Spike on Stock & Delivery, inspecting Oversell Risk, and clicking +20 Restock.",
  },
  {
    title: "Governance: PCI DSS, GDPR & role-based masking.",
    intro:
      "Server-enforced RBAC ensures sensitive payment and customer data is protected before reaching any browser or export.",
    items: [
      [
        "PCI DSS payment protection",
        "Raw card numbers never leave the server. Ops and Manila Branch Managers see last-4 tokens (•••• •••• •••• 4242); Marketing & Auditors see [PCI DSS Restricted/Masked].",
      ],
      [
        "GDPR consent enforcement",
        "Customers marked Opted Out automatically have email/phone redacted for Marketing and their Personalized Offers suppressed under GDPR Article 21.",
      ],
      [
        "Branch isolation",
        "The Manila Branch Manager sees only Manila POS revenue and Manila-linked buyers with customer emails/phones masked — zero visibility into Cebu or national online totals.",
      ],
      [
        "Append-only SHA-256 audit chain",
        "Protected by PostgreSQL triggers, every sign-in, sale, consent toggle, and PDF/CSV export is hash-chained and verifiable under Sales & Privacy.",
      ],
    ],
    notes:
      "Open Customers & Offers and click the top-bar Role Switcher (Marketing -> Manila Branch -> Auditor) to show PCI DSS and GDPR masking transform live.",
  },
  {
    title: "Comparative industry matrix.",
    intro:
      "Every group's industry shares the same Sources → Integration → Governance → Outputs pattern with tailored compliance needs.",
    items: [],
    notes:
      "Point out the highlighted Retail & E-Commerce row and compare PCI DSS / GDPR + Real-time APIs/CDC/Virtualization with Banking, Healthcare, Manufacturing, and Education.",
  },
  {
    title: "Live 3-minute class walkthrough.",
    intro:
      "Everything on the Retail & E-Commerce slide can be demonstrated live across four simple views.",
    items: [
      [
        "1. Live Flow (Home)",
        "Click In-Store Purchase, Online Order + 3PL, or 11.11 Flash Sale Spike and read 'What just happened' beside the 4-column Sources -> Outputs diagram.",
      ],
      [
        "2. Stock & Delivery",
        "Inspect the live DummyJSON product cards (Manila, Cebu, Online counts) or import new items via Catalog API, watch Eyeshadow Palette with Mirror flip to Oversell Risk during a spike, and click +20 Restock to recover.",
      ],
      [
        "3. Customers & Offers",
        "Toggle GDPR consent right on Bianca Dela Rosa's card (Offer Blocked <-> Active), then click Marketing, Manila Branch, or Auditor in the top bar.",
      ],
      [
        "4. Sales & Privacy",
        "Compare Manila vs Cebu vs Online revenue cards, inspect the live PCI DSS / GDPR comparison, verify the SHA-256 log, and expand Raw Data if asked.",
      ],
    ],
    notes:
      "Click Reset Demo on Live Flow or Stock & Delivery anytime to return all 5 PostgreSQL feeds cleanly to baseline.",
  },
];
