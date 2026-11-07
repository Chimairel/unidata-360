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
    title: "One student lifecycle. Three disconnected systems.",
    intro:
      "UniData 360 connects student information, learning activity, and library records into a governed view for university staff and students.",
    items: [
      [
        "The industry",
        "Education / Universities. Our group maps the full Enterprise Data Management lifecycle using synthetic university records.",
      ],
      [
        "The central problem",
        "Separate systems tell incomplete stories. A strong GPA can hide declining attendance; a library hold can block clearance.",
      ],
      [
        "The working application",
        "A Next.js frontend and server API backed by a persistent PostgreSQL database.",
      ],
      [
        "The outcome",
        "A Student 360 dossier, explainable early-warning indicators, and an inspectable governance trail.",
      ],
    ],
    notes:
      "Introduce the group and industry choice. Explain that all students are synthetic and the app runs locally on port 3005.",
  },
  {
    title: "Map the complete EDM lifecycle.",
    intro:
      "The course asks every industry to follow the same sequence. Our implementation makes each stage observable.",
    items: [
      [
        "1. Data sources",
        "SIS demographics and GPA; LMS courses, attendance and scores; Library loans, fines and clearance.",
      ],
      [
        "2. Integration methods",
        "CSV/JSON ingestion through APIs, schema validation, upsert deduplication, entity resolution by studentId, and ETL into the master store.",
      ],
      [
        "3. Governance needs",
        "FERPA/GDPR-inspired field masking, server-side role checks, student self-access, and append-only audit events.",
      ],
      [
        "4. Outputs",
        "Unified Student 360, academic analytics, advisor follow-ups, role-scoped PDF reports, and CSV audit exports.",
      ],
    ],
    notes:
      "Walk left to right through the flow. Distinguish the course’s broad industry model from the three implemented sources.",
  },
  {
    title: "Start with the sources, preserve their meaning.",
    intro:
      "Each source owns a different part of the student story. The student identifier connects records without flattening their purpose.",
    items: [
      [
        "SIS · identity & academic history",
        "Name, email, program, cumulative GPA, credits, academic standing, financial aid and SSN.",
      ],
      [
        "LMS · learning engagement",
        "Course scores, attendance, completed assignments, missed deadlines and last activity.",
      ],
      [
        "Library · campus clearance",
        "Active and overdue loans, outstanding fines, borrowing history and clearance holds.",
      ],
      [
        "Wider education ecosystem",
        "HR/payroll provides faculty and staff context; Alumni CRM extends the lifecycle beyond graduation. Both are mapped with owners and integration/governance needs in Course matrix; neither is a connected feed.",
      ],
    ],
    notes:
      "Open the raw source inspector during the demo. Point out the same studentId in SIS, LMS and Library. No live Canvas connection is claimed.",
  },
  {
    title: "Integration makes the relationships useful.",
    intro:
      "Imports are staged first. An explicit ETL run publishes a consistent master view while preserving run history.",
    items: [
      [
        "Extract & validate",
        "Accept CSV or JSON with the expected schema. Reject malformed dates, out-of-range numbers, missing fields and invalid enums before writing.",
      ],
      [
        "Cleanse & deduplicate",
        "Trim text, normalize email addresses, and upsert by studentId. LMS uses studentId + courseCode; repeated keys use the last row.",
      ],
      [
        "Resolve & reconcile",
        "Join LMS and Library to SIS. Exclude orphan references from the master view and record reconciliation notices.",
      ],
      [
        "Load the golden master",
        "Compute engagement summaries, data completeness and explainable risk. Commit results and an audit event together.",
      ],
    ],
    notes:
      "Upload a template, run ETL, then inspect the report. Add a demo student with no LMS to show incomplete data is not interpreted as zero attendance.",
  },
  {
    title: "Governance changes what the server returns.",
    intro:
      "The same stored record produces different projections for each persona, including PDF and JSON exports.",
    items: [
      [
        "Dean / Registrar",
        "Inspect source feeds and full records; import files, run ETL, and create advisor follow-ups.",
      ],
      [
        "Academic Advisor",
        "Read academic records while SSN, birth date and financial aid fields are restricted. Create internal follow-ups.",
      ],
      [
        "Student",
        "Read only the Marcus Vance demo record. Other student dossiers and audit logs are inaccessible through the API.",
      ],
      [
        "Compliance Auditor",
        "Read pseudonymized summaries and the complete audit trail. Raw feeds, financial aid and individual course details are withheld.",
      ],
    ],
    notes:
      "Switch personas in demo mode and inspect a dossier. Open Governance to show the hash chain. Explain that optional account mode requires local sign-in with fixed roles, while the open persona switch is a classroom demo tool. Neither establishes regulatory compliance.",
  },
  {
    title: "Turn integrated data into human action.",
    intro:
      "Outputs combine context from multiple systems and explain why a student needs review.",
    items: [
      [
        "Student 360",
        "One dossier combines demographics, GPA, LMS performance, library clearance, source completeness and synchronization time.",
      ],
      [
        "Academic analytics",
        "GPA distribution, program averages, enrollment snapshot and probation counts. Longitudinal retention is not available in this dataset.",
      ],
      [
        "Early-warning radar",
        "Transparent rules flag GPA, attendance, missed deadlines, probation and library holds. Staff review the signals before taking action.",
      ],
      [
        "Saved follow-ups & reports",
        "An advisor follow-up persists in PostgreSQL. Download a role-scoped PDF dossier or analytics report and trace exports in the audit trail.",
      ],
    ],
    notes:
      "Use Jordan Blake to show several risk signals. Save an advisor follow-up, reload the page, and show that it remains. This records an internal task and sends no external message.",
  },
  {
    title: "Different industries. A shared integration pattern.",
    intro:
      "The comparative matrix from the course reference shows how sources and obligations vary while the EDM lifecycle stays consistent.",
    items: [],
    notes:
      "Highlight the Education / Universities row. Compare it with healthcare: both consolidate a 360 view, but source systems and governance requirements differ. Matrix terms reproduce the supplied classroom reference.",
  },
  {
    title: "Demonstrate the complete lifecycle.",
    intro:
      "A short walkthrough connects every course requirement to a working feature.",
    items: [
      [
        "1. Ingest",
        "Open Integration pipeline, download a template or add a synthetic student, and stage the new record.",
      ],
      [
        "2. Integrate",
        "Run ETL. Review extracted rows, loaded master records, and any missing-source or orphan notices.",
      ],
      [
        "3. Govern",
        "Switch to Academic Advisor or Student. Inspect field masking and scope; return to staff to inspect audit events.",
      ],
      [
        "4. Share the outputs",
        "Open the new Student 360 dossier, download a PDF, review analytics, and save an advisor follow-up.",
      ],
    ],
    notes:
      "Close by stating the outcome: source data becomes governed, connected information. Local account sign-in is available now. Future work: institutional SSO, live vendor connectors, longitudinal retention datasets, and additional HR/alumni feeds.",
  },
  {
    title: "Follow enrollment through alumni.",
    intro:
      "The education case describes the complete university lifecycle. A scope map makes each implemented or proposed stage explicit.",
    items: [
      [
        "Enrollment",
        "SIS establishes the student identity, enrollment status, academic program, credits and authoritative GPA.",
      ],
      [
        "Learning",
        "LMS course activity joins the SIS record. Staff inspect explainable engagement signals and save internal follow-ups.",
      ],
      [
        "Graduation review",
        "Credits, enrollment status and library clearance supply review context. The system does not award degrees or calculate institutional graduation eligibility.",
      ],
      [
        "Alumni",
        "The wider model hands graduate identity to Alumni CRM under a defined purpose and contact-preference policy. This connector is mapped as a future extension.",
      ],
    ],
    notes:
      "Relate this sequence to integration.pptx slide 17. Open Course matrix to show all five source owners and the implemented-versus-modeled boundary. HR/payroll provides staff context and requires separate employee permissions.",
  },
  {
    title: "Explain the integration trade-offs.",
    intro:
      "The lecture presents alternative methods. This release chooses batch ETL and a same-origin API for a local demonstration.",
    items: [
      [
        "Batch ETL",
        "Validate and stage source files, reconcile identifiers, then load a consistent master transactionally. The registrar chooses when the master changes.",
      ],
      [
        "Other methods",
        "ELT, CDC, virtualization and Data Fabric suit other latency, scale or deployment needs. They are explained in the course mapping and are not claimed as implemented.",
      ],
      [
        "Ownership and quality",
        "Registrar, academic departments and Library own the source meanings. Schema validation, duplicate handling, missing-source notices and run metrics make quality visible.",
      ],
      [
        "Governance and outcomes",
        "Server role checks and masked reports protect the demonstration views. Success means connected records, explainable staff review and traceable operations; formal compliance and production capacity need separate acceptance.",
      ],
    ],
    notes:
      "Connect slides 3, 8, 10, 12 and 13 of the supplied deck. Batch updates trade immediacy for a clear publish boundary. A local API is not evidence of real-time vendor integration or of a Data Fabric deployment.",
  },
];
