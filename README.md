# UniData 360 · Enterprise Data Management

A full-stack classroom demonstration of the Education / Universities EDM lifecycle:

**SIS, LMS, Library → validated ingestion & ETL → role-based governance → Student 360 & academic analytics.**

## Run locally

Requires **Node.js 24 or newer** and a **PostgreSQL 14 or newer** database. The classroom setup uses the shared Neon database for local and online access.

```powershell
Copy-Item backend/.env.example backend/.env.local
npm ci
```

Set `DATABASE_URL` in `backend/.env.local` to the shared database's connection string. For Neon, use the pooled connection string. Transfer the existing private `backend/.env.local` to each presentation device; Git does not include it. For a local PostgreSQL server without TLS, use the loopback address and append `?sslmode=disable`. Then run `npm run dev` from the root.

Open **http://localhost:3005**. The frontend runs on **3005**, and its API requests are forwarded to the backend on **3006**. Run `npm run dev` once from the root to start both.

You can also start each service in its own terminal:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Use either the root command or the two separate terminals. Stop the running servers with Ctrl+C before starting them again.

UniData creates the schema and seeds the synthetic student feeds on first use. Keep your connection string and real `.env` files outside Git. Local and hosted applications share accounts and records when configured with the shared database; changes in either appear in both.

For the production build:

```powershell
npm run build
npm start
```

The root `npm run build` builds both applications, and `npm start` starts them on the same two ports.

## Deploy online

See [deployment instructions](docs/DEPLOYMENT.md) for the Vercel deployment and Neon PostgreSQL database. The hosted app requires provisioned accounts and starts with a fresh synthetic dataset. The Railway container remains available for a future deployment.

## What is implemented

- **Persistent PostgreSQL:** source rows, golden master records, ETL run history, sessions, advisor follow-ups and audit history survive reloads and server restarts.
- **Ingestion:** drag-and-drop or file-picker upload for SIS, LMS and Library CSV/JSON files. Download a matching template from the integration tab. Files are limited to 2 MB and 1,000 rows; malformed batches produce row-level errors without partial writes.
- **ETL:** validate incoming types and ranges, normalize names/emails, deduplicate feed keys, reconcile by `studentId`, record orphan/missing-source notices, and load master records transactionally.
- **Student 360:** searchable/filterable directory with compact list, sortable table and card views, explicit risk filters and an advisor-attention shortcut, detailed academic and campus dossiers, role-scoped JSON and downloadable printable PDF reports. The statistics column compares permitted students by GPA or LMS attendance and shows source completeness and an attention queue.
- **Analytics:** GPA bands, program averages, probation counts, current enrollment snapshot, explainable warning rules and persisted internal advisor follow-ups.
- **Governance:** server-applied field masking, student self-access, role-gated writes/exports, hash-chained append-only audit trail, action filters and CSV export.
- **Account access:** email/password sign-in, fixed server-assigned roles, linked student identities, salted password hashes, hashed session tokens, sign-out revocation and login throttling. Demo mode remains available for class.
- **Student registration:** matching SIS/master student ID and email, single-use email verification, student-only activation and administrator-created staff accounts. See [registration setup](docs/STUDENT_REGISTRATION.md) for Resend delivery and local classroom previews.
- **Presentation:** ten classroom slides, the supplied comparative industry matrix, a five-source university responsibility map, enrollment-to-alumni scope, integration trade-offs, speaker notes, previous/next controls, direct slide selection, arrow/PageUp/PageDown/Home/End keys and optional fullscreen.
- **UI:** reference-inspired light workspace with a black navigation rail, full-viewport white workspace, soft gray student rows and black actions; compact mobile navigation and single-column records, keyboard-accessible dialogs, visible focus states, loading/error/empty feedback and reduced-motion support. Ingestion, analytics, governance, sign-in and presentation share the monochrome theme.

## A five-minute classroom walkthrough

1. Select **Integration pipeline** and **Dean / Registrar**. Inspect SIS, LMS and Library rows.
2. Download a CSV or JSON template and import it, or use **Add demo student**. Imports update staged source feeds; they do not immediately change Student 360.
3. **Run pipeline**, inspect its reconciliation report, then open the student dossier in **Student 360**. A student without LMS data is marked incomplete rather than automatically treated as absent.
4. Switch **Demo persona** to Academic Advisor and open the same dossier to see restricted fields. Download a PDF with those restrictions applied. Student mode can access only Marcus Vance's demonstration record.
5. Open **Academic analytics**, inspect the early-warning radar, and save an advisor follow-up under the advisor/registrar persona. Reload to show persistence. This creates an internal task; it does not send an email or contact a real person.
6. Inspect **Governance & audit**, filter actions, verify the chain status, and export CSV.
7. Select **Present** for the ten-slide class walkthrough, or **Course matrix** for the industry comparison and five-source university lifecycle map. Restore the seed dataset from the integration tab when needed; the confirmation explains what is replaced. Audit and ETL history are retained.

## Architecture

The `EDM-Semifinals` root contains both application layers:

- `frontend/` is a Next.js application with its own package, config, pages, dashboard, sign-in components, styling, and browser state.
- `backend/` is a separate Next.js application with its own package, config, API routes, PostgreSQL storage, authentication, ETL, governance, and reports.
- `shared/` defines the data types exchanged between the two.

The root is an npm workspace. Install dependencies once from the root with `npm ci`. The frontend uses `BACKEND_URL` from `frontend/.env.local`, defaulting to `http://localhost:3006`. A template is supplied in `frontend/.env.example`. PostgreSQL credentials and account settings belong in `backend/.env.local`.

```text
Frontend Next.js server :3005 (EDMProvider fetches server snapshots)
           ↓ /api requests forwarded to BACKEND_URL
Backend Next.js server :3006
  ├─ GET/POST/DELETE /api/auth → access mode / sign-in / sign-out
  ├─ GET /api/edm       → current permitted snapshot
  ├─ POST /api/edm      → role / import / sync / view / intervention / reset
  └─ GET /api/reports   → student PDF / analytics PDF / dossier JSON / audit CSV
           ↓
  HttpOnly session → server access policy → validation / ETL / reports
           ↓
  PostgreSQL: sources, master, etl_runs, audit, interventions, sessions, users, login_attempts
```

`backend/storage.ts` connects to PostgreSQL using `DATABASE_URL` and initializes the schema and synthetic feeds on first use. Cloud connections verify the database server's TLS certificate.

Source upsert keys are `studentId` for SIS/Library and `studentId:courseCode` for LMS. Repeated keys use the last submitted row. All CSV headers must match the template. JSON contains an array. Dates use `YYYY-MM-DD`, with an optional `HH:mm` time for LMS activity. GPA ranges from 0 to 4, and percentages range from 0 to 100. Orphan LMS/Library rows remain inspectable in their source feed, are excluded from the golden master, and are reported by ETL.

The PostgreSQL audit trigger rejects `UPDATE`, `DELETE`, and `TRUNCATE`. Each event includes a UUID, UTC timestamp, and SHA-256 hash linked to the previous event. The UI displays times in Asia/Singapore. The chain provides application-level evidence of changes to audit history.

## Demonstration scope

All seed students and records are **synthetic**. The default demo mode permits classroom persona switching and is not authentication. Account mode is available for administrator-provisioned local credentials. Institutional identity, consent/legal workflows, infrastructure controls and operational review are still required before using real student data.

## Account mode

The [demo account guide](accounts/README.md) lists the four synthetic roles and emails. The original development device stores their passwords in Git-ignored `accounts/*.private.txt` files. Share the relevant password file privately when setting up another device.

1. Run `npm run account:create` in an interactive terminal. Enter an email, display name, one of the four role codes, and a password of 12–128 characters. Password input is hidden. There are no default accounts or passwords. Student accounts require an existing student ID from the master store.
2. Set `EDM_AUTH_MODE=accounts` in `backend/.env.local`, or set `$env:EDM_AUTH_MODE='accounts'` in PowerShell before starting the servers. Restart the backend on port 3006. The default is `demo` when unset.
3. Open **http://localhost:3005/login**. Anonymous API requests are rejected in account mode. The account role cannot be changed through the persona endpoint. A student account can only access its linked student record, including reports.
4. Run `npm run account:password` to reset a provisioned account's password. This revokes all its existing sessions and clears its login lockout. Both account commands load `DATABASE_URL` from the backend environment files.

Passwords use salted scrypt hashes, and PostgreSQL stores SHA-256 hashes of session tokens. Account sessions expire after 8 hours, and sign-out revokes the server session. Five failed logins for an email trigger a persistent 15-minute lockout. Advisor audit views filter by account identity. Sign-in and sign-out events record the display name and account ID.

Set `EDM_SECURE_COOKIES=true` when serving over HTTPS and false for local HTTP. Set `EDM_PUBLIC_ORIGIN` to the frontend origin in the backend environment. It defaults to `http://localhost:3005` for local runs. The frontend proxies cookies and API responses, so browser requests use the frontend address. Provisioning and password resets use the account CLI. Disabling an account with `active=0` revokes access on subsequent requests.

FERPA and GDPR are the course's governance context; this project demonstrates selected technical controls and does not certify compliance. Risk categories are transparent classroom rules for human review, not predictions or automated student decisions. Current enrollment is a snapshot, not a measured retention rate.

The supplied course matrix also includes HR, Alumni CRM, Data Fabric, and vendor APIs. The app implements three synthetic feeds, a Next.js API, CSV/JSON ingestion and ETL; it does not claim a live Canvas/vendor connection or implemented HR/alumni connectors.

## Validation

```powershell
npm test         # set EDM_TEST_DATABASE_URL to include database checks
npm run test:api # run against a local demo backed by a disposable database
npm run test:auth -- --hosted
npm run lint
npm run build
```

`test:api` is intended for the synthetic local demo: it stages seed rows, creates a follow-up, changes its own session persona, checks reports, and restores seed sources/follow-ups. Its audit and ETL events remain. It saves sample masked PDFs in ignored `tmp/pdfs/` for visual inspection.

Set `EDM_TEST_DATABASE_URL` in the terminal to a fresh, empty PostgreSQL database for the database checks in `npm test` and for `test:auth`. Use a separate empty database for each run. Without this variable, `npm test` runs the checks that require no database. Build both applications and free ports 3005 and 3006 before running `test:auth`. It starts both servers, verifies all four roles, imports, ETL, reports, access controls, and audit integrity through the frontend proxy, then stops both process trees. The test accounts and events are written to the disposable database.

The current dependency audit reports development-tool advisories through the existing Next.js ESLint configuration (`braces` / `micromatch` / `fast-glob`). The suggested automatic fix downgrades Next.js lint tooling across major versions; it has not been applied. `npm audit --omit=dev` checks runtime dependencies separately.
