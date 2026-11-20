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
    title: "One student lifecycle. Disconnected university systems.",
    intro:
      "Estante integrates SIS, LMS, Library, HR/Payroll, and Alumni CRM into a governed master view across enrollment, learning, graduation, and alumni stages.",
    items: [
      [
        "The industry",
        "Education / Universities (BSIT, BEED, BSED, BSHM) using School IDs (YYYYMMDD) and Philippine 1.00–5.00 GWA grading (3.00 or worse = fail / 5.00).",
      ],
      [
        "The central problem",
        "Multiple vendors and siloed departments tell incomplete stories: declining LMS attendance hides behind early grades, library holds block graduation clearance, and HR/Alumni data sits apart.",
      ],
      [
        "The working application",
        "Next.js frontend and server API backed by persistent Neon PostgreSQL, 5-feed batch ETL, Data Quality stewardship, and Advising Cases.",
      ],
      [
        "The outcome",
        "Unified Student 360 dossiers, GWA analytics & early-warning radar, Registrar graduation handoff to Alumni CRM, and a hash-chained audit trail.",
      ],
    ],
    notes:
      "Introduce the Education / Universities case. Explain that all 5 data sources from the slide (SIS, LMS, Library, HR/Payroll, Alumni CRM) run live on PostgreSQL (ports 3005 and 3006).",
  },
  {
    title: "Education data integration flowchart.",
    intro:
      "5 Live Sources → Integration & DQM → FERPA/GDPR Governance → Governed Outputs, Analytics & AI Readiness.",
    items: [],
    notes:
      "Walk left to right through the diagram: all 5 sources (SIS, LMS, Library, HR/Payroll, Alumni CRM) show live PostgreSQL row counts, flowing through DQM + FERPA/GDPR Governance into Student 360, Cases, Quality, and Analytics.",
  },
  {
    title: "Start with five sources, preserve their meaning.",
    intro:
      "Each source represents an independent campus vendor and owner, reconciled without flattening departmental ownership.",
    items: [
      [
        "SIS · identity & academic history",
        "Owned by the Registrar. School ID (YYYYMMDD), email, department, program, GWA (1.00–5.00), credits, standing, financial aid, and SSN.",
      ],
      [
        "LMS · learning engagement",
        "Owned by academic departments. Course scores, attendance percentages, assignments, missed deadlines, and activity timestamps.",
      ],
      [
        "Library & HR/Payroll · campus context",
        "Library tracks loans, overdue items, fines, and holds; HR/Payroll maps faculty advisors, courses taught, and role-masked payroll bands.",
      ],
      [
        "Alumni CRM · post-graduation handoff",
        "Owned by Alumni Relations. Tracks graduation year, conferred degree, employment status, employer, and GDPR Opted In / Opted Out consent.",
      ],
    ],
    notes:
      "Open Integration pipeline -> Source record inspector to inspect all 5 tabs (SIS, LMS, LIBRARY, HR, ALUMNI) live in the app.",
  },
  {
    title: "ETL: Extract, Transform, Load.",
    intro:
      "Imports validate atomically into staging first. An explicit ETL run cleanses, applies grading & business rules, reconciles all 5 feeds, and publishes transactionally.",
    items: [
      [
        "Extract & validate",
        "Ingest CSV or JSON across SIS, LMS, Library, HR, and Alumni (up to 2 MB / 1,000 rows). Reject out-of-range numbers, invalid dates, or unknown columns.",
      ],
      [
        "Transform: standardize & enforce rules",
        "Normalize name casing, slash dates (ISO YYYY-MM-DD), department codes, emails, and enforce the 1.00–5.00 rule (exact 3.00 or worse normalized to 5.00 fail).",
      ],
      [
        "Transform: combine 5 sources",
        "Join LMS, Library, and Alumni CRM by studentId and HR/Payroll faculty context by advisor name; compute completeness (core feeds ÷ 3) and risk flags.",
      ],
      [
        "Load the golden master",
        "Commit the unified master table, ETL run report, quality reconciliation, and hash-chained audit entry together in one PostgreSQL transaction.",
      ],
    ],
    notes:
      "Show Integration pipeline: upload or inspect records and run ETL to see standardization, [Business Rule] 3.00 -> 5.00 normalization, and cross-source reconciliation.",
  },
  {
    title: "Data Quality Management: automated and stewarded.",
    intro:
      "Every ETL run checks cross-source integrity across campus feeds and maintains an issue queue with ownership, lineage, and re-verification.",
    items: [
      [
        "Automated quality checks",
        "Detects MISSING_LMS, MISSING_LIBRARY, ORPHAN_LMS, and ORPHAN_LIBRARY on every ETL run with stable issue IDs and first/last-seen timestamps.",
      ],
      [
        "Stewardship & staged repair",
        "Registrars assign stewards, record notes, and relink orphaned LMS/Library rows to valid SIS identities with destination collision protection.",
      ],
      [
        "ETL-confirmed resolution",
        "Issues cannot be manually forged to Resolved. They close only when a subsequent ETL recheck passes, and reopen if the source regresses.",
      ],
      [
        "5-source catalog & provenance",
        "Tracks owners (Registrar, Departments, Library, HR, Alumni), record keys, receipt timestamps, revisions, and the 30 most recent ETL runs.",
      ],
    ],
    notes:
      "Open Data quality -> Source catalog & provenance to show all 5 source systems listed with owners and live row counts.",
  },
  {
    title: "Governance: FERPA, GDPR & secure student/faculty access.",
    intro:
      "Server-enforced RBAC, PII/payroll masking, and GDPR consent controls protect every API response and export across students, faculty, and staff.",
    items: [
      [
        "Registrar & System Admin (IT)",
        "System Admin manages staff accounts only (zero student records). Registrar stewards all 5 feeds, ETL, student portal accounts, and walk-in resets.",
      ],
      [
        "Deans & Academic Advisors / Faculty",
        "Deans see only their assigned department (BSIT, BEED, BSED, BSHM). Deans & Advisors/Faculty receive masked SSN, DOB, financial aid, HR payroll bands, and GDPR-masked alumni.",
      ],
      [
        "Mandatory student 123456 onboarding",
        "Students receive default password 123456 upon SIS enrollment, confirm their enrollment email & set a strong personal password at first login (/onboarding), and view only their own record.",
      ],
      [
        "Compliance Auditor & audit chain",
        "Auditors see pseudonymized Student XXX summaries, restricted HR/DOB fields, read-only Quality, and the SHA-256 hash-chained audit trail protected by PostgreSQL triggers.",
      ],
    ],
    notes:
      "Emphasize how both Student security (123456 mandatory onboarding, self-access) and Faculty/Department boundaries (Deans, Advisors/Faculty, HR payroll masking) are enforced server-side.",
  },
  {
    title: "Different industries. A shared integration pattern.",
    intro:
      "The comparative matrix from the course reference shows how sources and compliance needs differ while the EDM lifecycle stays universal.",
    items: [],
    notes:
      "Highlight the Education / Universities row (SIS, LMS, HR, Library, Alumni CRM | FERPA, GDPR) and compare with Healthcare and Banking.",
  },
  {
    title: "Outputs, measured outcomes & AI readiness.",
    intro:
      "Success is measured by staff workflows and student outcomes across the whole lifecycle — not just moving files between tables.",
    items: [
      [
        "Student 360, HR & Alumni dossier",
        "Unifies academics (GWA 1.00–5.00), LMS engagement, Library holds, HR faculty advisor context, and Alumni CRM consent in one governed dossier and PDF/JSON.",
      ],
      [
        "Academic analytics & early warning",
        "GWA distribution bands (1.00–1.75 Dean's List through 3.00–5.00 Fail), inverted GWA cohort chart, program averages, and early-warning radar.",
      ],
      [
        "Advising cases & outcomes",
        "Faculty advisors and Deans open cases from flagged students, record private staff-only notes, set due dates, and track resolution outcomes.",
      ],
      [
        "AI & ML readiness foundation",
        "Current warning rules are deterministic and explainable (not black-box ML). Clean, deduplicated 5-source master data provides the foundation for trustworthy AI.",
      ],
    ],
    notes:
      "Open Student 360 -> click a student dossier -> point out LMS, Library, and HR Faculty context, plus the analytics charts on the 1.00–5.00 GWA scale.",
  },
  {
    title: "Live lifecycle: Enrollment to Alumni CRM.",
    intro:
      "Every stage from initial SIS enrollment through graduation clearance and post-graduation Alumni CRM runs live in Estante.",
    items: [
      [
        "Enrollment",
        "Registrar encodes/imports SIS record (YYYYMMDD ID), provisions portal login (123456), and student completes mandatory first-login onboarding.",
      ],
      [
        "Learning",
        "LMS attendance, scores, and deadlines join SIS GWA (1.00–5.00) and HR faculty advisor records to drive analytics and Advising Cases.",
      ],
      [
        "Graduation",
        "Credits, academic standing, and Library clearance surface graduation blockers; Registrar triggers one-click Graduate -> Alumni inside Student 360.",
      ],
      [
        "Alumni CRM",
        "Graduated students transition immediately into the live Alumni CRM feed with degree, placement tracking, and GDPR Opted In / Opted Out enforcement.",
      ],
    ],
    notes:
      "Demonstrate the full lifecycle live by clicking 'Graduate -> Alumni' inside a Student 360 dossier as Registrar, then viewing the updated ALUMNI feed and GDPR consent flag.",
  },
  {
    title: "Integration trade-offs & live demonstration.",
    intro:
      "Estante uses Batch ETL + REST APIs for a clear governance boundary across 5 campus sources, with enterprise scaling paths documented.",
    items: [
      [
        "Why Batch ETL + REST APIs",
        "Uploads validate atomically into staging; the Registrar controls when ETL reconciles and publishes to Student 360. ELT, CDC, and Data Fabric fit larger multi-cloud scale.",
      ],
      [
        "1. Ingest & inspect 5 sources",
        "Open Integration pipeline -> inspect SIS, LMS, LIBRARY, HR, and ALUMNI -> add a student or upload CSV/JSON -> Run pipeline.",
      ],
      [
        "2. Monitor & repair quality",
        "Open Data quality to review the 5-source catalog, assign a steward or relink an orphan issue, and rerun ETL to confirm resolution.",
      ],
      [
        "3. Graduate, mask & verify audit",
        "Graduate a student to Alumni CRM in Student 360, then sign in as Dean / Advisor / Student / Compliance Auditor to verify RBAC, payroll/GDPR masking, and the audit hash chain.",
      ],
    ],
    notes:
      "Close by connecting all 3 requirements from the Education slide: 5 sources (SIS, LMS, HR, Library, Alumni CRM), full lifecycle + FERPA/GDPR, and solving vendor, departmental silo, and student/faculty access challenges.",
  },
];
