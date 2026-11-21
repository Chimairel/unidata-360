# Karto Staff Accounts

**Karto** uses **PostgreSQL** (**Structured Query Language** relational database) authentication (`retail_users` and `retail_sessions`) seeded automatically on first database startup. Opening `http://localhost:3005` always requires signing in at `/login`, while the customer storefront at `http://localhost:3005/shop` stays public for online shoppers.

## Seeded Staff Roles (Local Demo Password: `123456`)

All four accounts use real **RBAC** (**Role-Based Access Control** — job-specific permissions) and **PCI DSS** (**Payment Card Industry Data Security Standard** — payment card protection) / **GDPR** (**General Data Protection Regulation** — personal data privacy) masking enforced on the backend:

| Staff Member | Work Email | Password | Role & Access Scope |
| :--- | :--- | :--- | :--- |
| **Lourdes Bautista** | `ops@karto.ph` | `123456` | Store Operations Manager — Full access across all 5 data feeds, **POS** (**Point of Sale** — physical cash register) checkouts, stock sync, **3PL** (**Third-Party Logistics** — courier tracking), 11.11 stress test, masked card logs, and dataset reset. |
| **Camille Reyes** | `marketing@karto.ph` | `123456` | Marketing & **CRM** (**Customer Relationship Management** — loyalty profiles & promotions) — Manages opted-in personalized campaigns and consents; cardholder payment numbers are restricted and **GDPR** opt-out customers are hidden. |
| **Marco Villanueva** | `manila@karto.ph` | `123456` | Manila Branch Manager — Scoped strictly to Manila **POS** checkouts and Manila store stock; Cebu branch, Online totals, and **PII** (**Personally Identifiable Information** — customer emails & phone numbers) are masked. |
| **Atty. Gabriel Torres** | `auditor@karto.ph` | `123456` | Compliance Auditor — Strictly read-only inspection across all tabs; customer identities are pseudonymized, **PII** and full **PAN** (**Primary Account Number** — full 16-digit card numbers) are masked, and every action is verified against the **SHA-256** (**Secure Hash Algorithm 256-bit** — tamper-evident cryptographic hash) audit chain. |

## Environment & Database Notes

- Database credentials live exclusively in `backend/.env.local` (your local environment configuration file, which is excluded from Git by `.gitignore`). Copy `backend/.env.local` privately to any presentation device running against the same Neon **PostgreSQL** instance.
- All devices configured with the same `DATABASE_URL` (**URL** — Uniform Resource Locator database connection string) share the same live users, orders, inventory counts, and append-only audit trail.

## Hosted Staff Passwords

Render generates a password for each staff role when the Blueprint is first applied. Use the same work emails shown above and get the matching password from the API service's Environment page in the Render dashboard.

| Staff email | Render environment variable |
| --- | --- |
| `ops@karto.ph` | `EDM_STAFF_OPS_MANAGER_PASSWORD` |
| `marketing@karto.ph` | `EDM_STAFF_MARKETING_CRM_PASSWORD` |
| `manila@karto.ph` | `EDM_STAFF_BRANCH_MANAGER_PASSWORD` |
| `auditor@karto.ph` | `EDM_STAFF_COMPLIANCE_AUDITOR_PASSWORD` |
