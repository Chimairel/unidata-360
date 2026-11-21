# Karto Staff Accounts

**Karto** uses **PostgreSQL** (**Structured Query Language** relational database) authentication (`retail_users` and `retail_sessions`) seeded automatically on first database startup. Opening `http://localhost:3005` always requires signing in at `/login`, while the customer storefront at `http://localhost:3005/shop` stays public for online shoppers.

## Seeded staff accounts

All eight staff accounts below use the password **`123456`** on the local and hosted classroom demos. Use the cashier emails for walk-in sales and `manila@karto.ph` for the Manila Branch Manager. [Open the hosted staff sign-in](https://karto-edm.vercel.app/login).

Staff accounts use **RBAC** (Role-Based Access Control), **PCI DSS** (Payment Card Industry Data Security Standard) masking, and **GDPR** (General Data Protection Regulation) privacy controls. The backend enforces permissions for both data access and updates.

| Staff Member | Work Email | Password | Role & Access Scope |
| :--- | :--- | :--- | :--- |
| **Lourdes Bautista** | `ops@karto.ph` | `123456` | Store Operations Manager. Opens the combined stock and delivery view. Reviews all five feeds, data quality, and audited staff updates. Runs the 11.11 simulation. |
| **Bea Santos** | `cashier.manila@karto.ph` | `123456` | Manila Cashier. Records walk-in sales and prints receipts at the Manila **POS** (Point of Sale) register. |
| **Nico Lim** | `cashier.cebu@karto.ph` | `123456` | Cebu Cashier. Records walk-in sales and prints receipts at the Cebu register. |
| **Iris Mendoza** | `inventory@karto.ph` | `123456` | Inventory Staff. Checks stock, restocks products, and transfers units between Manila, Cebu, and the online warehouse. |
| **Rafael Cruz** | `delivery@karto.ph` | `123456` | Delivery Coordinator. Dispatches website orders and updates **3PL** (Third-Party Logistics) shipments, tracking, and delays. |
| **Camille Reyes** | `marketing@karto.ph` | `123456` | Marketing and **CRM** (Customer Relationship Management). Manages consent and personalized offers. Opted-out contact details and payment card numbers are masked in this view. |
| **Marco Villanueva** | `manila@karto.ph` | `123456` | Manila Branch Manager. Records Manila register sales and views Manila sales analytics. Customer email addresses and phone numbers are masked. |
| **Atty. Gabriel Torres** | `auditor@karto.ph` | `123456` | Compliance Auditor. Reviews pseudonymized records and the **SHA-256** (Secure Hash Algorithm 256-bit) audit chain. Customer contact and payment card information are masked. |

## Presentation walkthrough

1. Record a walk-in sale as the Manila or Cebu cashier. The receipt shows the branch, and only that branch's stock decreases.
2. Open `/shop` as a customer and place an order. Online warehouse stock decreases and the receipt includes courier tracking. Sign in as the Delivery Coordinator to move the shipment to **In Transit** and flag a delay.
3. Sign in as Inventory Staff to inspect the new counts and demonstrate a restock or stock transfer.
4. Sign in as Operations and open **Stock**, **Sales & Audit**, and **Quality**. Show the updated counts, the staff account credited with each change, and the flagged shipment.

[Download the Karto presentation guide](../docs/Karto_Core_Concepts_Presentation_Guide.docx) for the three core concepts, seven data quality dimensions, and what to open for each demonstration.

## Environment & Database Notes

- Database credentials live exclusively in `backend/.env.local` (your local environment configuration file, which is excluded from Git by `.gitignore`). Copy `backend/.env.local` privately to any presentation device running against the same Neon **PostgreSQL** instance.
- All devices configured with the same `DATABASE_URL` (**URL** — Uniform Resource Locator database connection string) share the same live users, orders, inventory counts, and append-only audit trail.

## Hosted Staff Passwords

The [live Karto demo](https://karto-edm.vercel.app/login) uses the same staff emails and password as the local demo. The Render Blueprint enables this with `EDM_DEMO_STAFF_PASSWORDS=true`.

Hosting with demo passwords disabled uses a separate configured password for each staff role. Add the specialist password variables to seed the specialist accounts on a non-demo host. Both cashier accounts use the cashier password variable. On Render, manage them in the backend service's Environment page.

| Staff email | Render environment variable |
| --- | --- |
| `ops@karto.ph` | `EDM_STAFF_OPS_MANAGER_PASSWORD` |
| `marketing@karto.ph` | `EDM_STAFF_MARKETING_CRM_PASSWORD` |
| `manila@karto.ph` | `EDM_STAFF_BRANCH_MANAGER_PASSWORD` |
| `auditor@karto.ph` | `EDM_STAFF_COMPLIANCE_AUDITOR_PASSWORD` |
| `cashier.manila@karto.ph`, `cashier.cebu@karto.ph` | `EDM_STAFF_CASHIER_PASSWORD` |
| `inventory@karto.ph` | `EDM_STAFF_INVENTORY_STAFF_PASSWORD` |
| `delivery@karto.ph` | `EDM_STAFF_DELIVERY_COORDINATOR_PASSWORD` |
