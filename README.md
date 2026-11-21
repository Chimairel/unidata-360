# Karto · Retail & E-Commerce EDM

**Karto** is a full-stack omnichannel retail **EDM** (**Enterprise Data Management** — unifying and governing data across company systems as one trusted truth) platform combining a public customer e-commerce storefront (`/shop`) with a role-protected operations hub (`/`).

## Integrated Architecture

1. **5 Connected Retail Source Feeds:**
   - **POS** (**Point of Sale** — physical store checkout registers in Manila & Cebu)
   - **Inventory** (branch shelves, online warehouse stock, and catalog metadata)
   - **CRM** (**Customer Relationship Management** — loyalty tiers, points balance, favorite categories, and consent)
   - **Online Storefront** (`/shop` web orders and real-time checkout)
   - **3PL Delivery** (**Third-Party Logistics** — courier tracking across LBC Express, J&T Express, GrabExpress, and DHL)
2. **Real-Time Integration & Data Quality:**
   - **Real-Time API** (**Application Programming Interface** — live request/response checkout bridge) and **CDC** (**Change Data Capture** — instant row-level stock & order event stream)
   - **ETL** (**Extract, Transform, Load** — automated pipeline) and **DQM** (**Data Quality Management** — negative stock / oversell detection, duplicate handling, and **CSV** / **JSON**, Comma-Separated Values / JavaScript Object Notation, validation)
3. **Governance, Privacy & Tamper-Evident Audit:**
   - **RBAC** (**Role-Based Access Control** — strict permissions for Store Operations, Marketing & CRM, Manila Branch Manager, and Compliance Auditor)
   - **PCI DSS** (**Payment Card Industry Data Security Standard**) masking — never exposes raw 16-digit **PAN** (**Primary Account Number**) digits
   - **GDPR** (**General Data Protection Regulation**) enforcement — blocks automated promotions on `Opted Out` customers and masks/pseudonymizes **PII** (**Personally Identifiable Information** — emails and phone numbers)
   - Append-only **PostgreSQL** (**Structured Query Language** relational database) audit log signed with a verifiable **SHA-256** (**Secure Hash Algorithm 256-bit** — tamper-evident hash chain)

## Run Locally

Requires **Node.js 24+** and **PostgreSQL** (such as Neon cloud PostgreSQL).

```powershell
Copy-Item backend/.env.example backend/.env.local
npm ci --include=dev
```

Set `DATABASE_URL` (**URL** — Uniform Resource Locator connection string) inside `backend/.env.local` (your local environment configuration file; keep it out of Git). For local PostgreSQL without **TLS** (**Transport Layer Security** encryption), append `?sslmode=disable`.

Start both the frontend (**http://localhost:3005**) and backend (**http://localhost:3006**):

```powershell
npm run dev
```

Or run the production build:

```powershell
npm run build
npm start
```

### Verification Commands

```powershell
npm test
npm run lint
npm run build
```

## Key Routes & Documentation

- **Online Storefront (public):** `http://localhost:3005/shop`
- **Operations Hub (staff login required):** `http://localhost:3005` (`/login`)
- **Staff Accounts Guide:** [accounts/README.md](accounts/README.md)
- **Software Requirements Specification (SRS, version 2.1):** [docs/Karto_Software_Requirements_Specification.docx](docs/Karto_Software_Requirements_Specification.docx)
