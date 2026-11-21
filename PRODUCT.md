# Estante
<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Store Operations Managers, Marketing & CRM Specialists, Manila Branch Managers, and PCI DSS / GDPR Compliance Auditors are the four live demonstration roles presented in class with a one-click top-bar switcher.

## Product Purpose
Demonstrate Retail & E-Commerce Enterprise Data Management cleanly: 5 sources (POS, Inventory, CRM, Online Storefront, 3PL Logistics) unified through Real-Time APIs, CDC, and Virtualization under PCI DSS and GDPR into Stock Sync, Personalized Offers, and Sales Analytics.

## Operating Context
Frictionless classroom demonstration at `http://localhost:3005` backed by persistent Neon PostgreSQL (`retail_*` tables). Opens directly into the live workspace with no login wall and instant 1-click role switching (`OPS_MANAGER`, `MARKETING_CRM`, `BRANCH_MANAGER`, `COMPLIANCE_AUDITOR`).

## Capabilities and Constraints
Next.js 16.4.5 App Router, React 19, TypeScript, and CSS variables on ports 3005 (frontend) and 3006 (backend).
- **Four clear views:** `Live Flow` (scenarios + 4-column Sources → Integration → Governance → Outputs pipeline), `Stock & Delivery` (branch/online inventory cards + 3PL courier status), `Customers & Offers` (unified customer profiles + live GDPR consent toggle + role-masked cards), and `Sales & Privacy` (unified Peso sales + role masking proof + SHA-256 audit log + collapsed raw data/CSV drawer).
- **Server-enforced governance:** Zero raw 16-digit PANs leave the backend (`•••• •••• •••• 4242` for Ops/Branch, `[PCI DSS Restricted]` for Marketing, `[PCI DSS Masked]` for Auditor); GDPR Opt-Out suppresses automated offers and masks contact PII for Marketing; Branch Manager sees Manila POS only; Auditor sees pseudonymized `Customer #01..#06` records.

## Brand Commitments
Preserve the Estante brand ("shelf"), the inset `#111113` black rail, white/soft-gray workspace (`#ffffff` / `#f5f5f7`), Geist typography with tabular Peso numbers and Geist Mono identifiers, persistent light/dark theme toggle, and still Mercury liquid backdrop.

## Product Principles
Lead with a clear 4-stage visual flow, never nest cards inside cards, keep functional UI labels at 11px+, and place raw multi-feed tables and batch uploads behind progressive disclosure so every screen reads calmly during a live presentation.
