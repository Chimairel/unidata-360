# UniData 360 MVP journeys

## Full six-role MVP regression — 17 November 2026

Completed against the local production frontend on 3005 and backend on 3006, using disposable PostgreSQL schemas and synthetic accounts. The shared classroom accounts and student data were not modified.

| Role | Browser journey verified | Result |
| --- | --- | --- |
| System Admin | Sign in to Accounts only; edit a staff display name without changing access scope; save, inspect feedback/activity, reload and confirm persistence; sign out. | Passed |
| Registrar | Search/filter school records, open a dossier, download PDF, stage a synthetic SIS record, run ETL and find the ninth master record; open and advance classroom slides; sign out. | Passed |
| Dean | BEED analytics and its two students only; masked dossier; save a department follow-up and confirm it after reload; download department analytics; inspect own activity; sign out. | Passed |
| Academic Advisor | School academic directory and radar; save Kofi's follow-up and confirm it after reload; inspect masked SSN, birth date and financial aid; no pipeline controls; sign out. | Passed |
| Student | School ID/password sign-in; personal record, courses and library clearance only; own PDF download; 390px mobile layout without document horizontal overflow; sign out. | Passed |
| Compliance Auditor | Governance landing page, verified audit chain, audit CSV download, pseudonymized directory and restricted dossier; no pipeline or academic analytics controls; sign out. | Passed |

Automated evidence: **27 tests passed, none skipped**, plus **203 production HTTP checks**: 117 staff/department checks, 28 student registration/recovery checks and 58 Admin checks. These exercise CSV/JSON ingestion, ETL, all four Dean departments, role escalation/forbidden actions, student record isolation, registration/activation/recovery, staff creation/access/status/password changes, session revocation, protected Admin/Student targets and audit integrity. Anonymous account requests return 401; forbidden role actions return 403, while inaccessible student records return 404 to avoid revealing their existence.

Downloaded browser artifacts: three valid PDFs (Registrar dossier, Dean analytics and Student report), with page counts and report/student metadata checked, and an audit CSV with the expected columns, hashes, ETL and follow-up events. The final browser console reported no errors. The production frontend build, TypeScript and ESLint passed after corrections.

Corrections made during this pass:

- Clear success/error messages when signing out or refreshing so a previous user's operation notice does not appear in the next user's workspace.
- Clear the authentication-required state after a successful snapshot fetch, including when a cached workspace resumes after sign-in.
- Give each SignIn instance unique React-generated input IDs so the inline form and cached `/login` page retain unambiguous labels.

Repeated Registrar → Dean → Advisor → Student → Auditor → Admin sign-in/sign-out checks passed after these corrections. The Registrar ETL notice was absent in the subsequent Dean session, and exact sign-in field labels remained usable through cached navigation.

Limitations: email flows used private local previews and mocked Resend tests, not a real inbox. Hosting remains paused; this is a local MVP verification, not a new hosted deployment. Disposable browser test data is removed after verification and the normal shared-database development servers are restored.

## System Admin staff accounts — 17 November 2026

System Admin now has a dedicated Accounts workspace. Students continue to self-register; Admin can create Registrar, Dean, Academic Advisor and Compliance Auditor accounts. Dean accounts require one of BSIT, BEED, BSED or BSHM. Admin has no student records, imports, ETL, academic analytics or academic reports.

- Passed all 27 automated tests with PostgreSQL checks enabled in an isolated schema and 58 Admin HTTP checks through frontend 3005/backend 3006. Checks cover all six roles, anonymous and unauthorized access, staff creation/access updates, activation/disable, password reset, session revocation, protected Admin/Student targets and audit integrity.
- Browser verification: Admin signs in to Accounts only; search filters the directory; create/edit forms expose the four Dean departments; password reset and disable dialogs identify the target account. Shared staff accounts were not changed during browser checks.
- Checked the Accounts workspace and stacked staff form at 390px mobile width without document horizontal overflow. Tables scroll within their own container. Admin sign-out returns to an enabled sign-in form.
- Provisioned `admin@cpc.edu` in the shared classroom PostgreSQL database. Repeating `npm run admin:setup` preserves its password. Credentials remain in ignored private account guides, including `accounts/admin.private.txt`.
- Both production builds, TypeScript and ESLint passed. Hosting remains paused; these results describe the local application and shared database.

## Student school ID sign-in and recovery — 14 November 2026

Students now use school ID + their existing password; staff continue using assigned email + password. Student email is used for activation and recovery, including Gmail addresses that match the school record. School IDs alone do not authenticate a student.

- Passed all 25 automated tests with PostgreSQL checks enabled in an isolated schema. New checks cover ID/email request validation, role injection, case/whitespace normalization, account lockout, hashed recovery tokens, expiry, email changes, replay rejection and revocation of sessions/recovery links.
- Passed 28 HTTP checks through the production frontend/backend proxy, including registration → school ID login → reset request → single-use reset → new-password login. Old sessions and old passwords were rejected, and registration links could not be used as recovery links or vice versa.
- Student email sign-in is rejected. Staff email sign-in remains supported, including the previous staff API request shape.
- Browser checks confirmed the existing shared student account signs in with `STU-2024-001` and its unchanged password, sees only its own record, and signs out. The Registrar signs in by email and retains its staff workspace. The recovery form was checked at 390px mobile width without horizontal overflow.
- Recovery uses the existing Resend configuration or private localhost email previews. Tests used isolated synthetic accounts and temporary previews; no real email was sent and shared account passwords were not reset.

## Department and role upgrade — 14 November 2026

Registrar and Dean are now separate roles, with BSIT, BEED, BSED and BSHM departments. The earlier four-role walkthrough below records the prior version; use [school setup](SCHOOL_SETUP.md) for the current role policy and upgrade instructions.

- Passed 22 automated tests with PostgreSQL checks enabled in an isolated schema, including department-assigned sessions, fail-closed scope, masked projections and validation of all four departments.
- Passed 117 end-to-end API checks through frontend 3005 and backend 3006. Each of the four Dean accounts accessed its own students/reports and was denied imports, ETL, reset, role escalation, other departments' dossiers, follow-ups and exports.
- Verified the repeatable school upgrade against legacy fixtures: existing password/GPA preserved, eight synthetic accounts provisioned, old course keys replaced without duplicates, and audit hashes retained.
- Browser checks: BSHM Dean starts in department analytics, sees only two BSHM students and has no pipeline controls. Registrar sees all four department filters; BEED filtering shows its two students and sets the analytics PDF scope. The Dean directory also fits a 390px mobile viewport without horizontal overflow.
- Applied the school upgrade to the shared classroom database without resetting student performance or audit history. The hosted application still needs a separate deployment of the new code.

## Earlier verification

Verified on 12 November 2026 using isolated PostgreSQL databases and the local production build (frontend 3005, backend 3006). These checks did not modify the shared presentation database. Synthetic test accounts were used; passwords and connection strings are excluded from this guide.

## Dean / Registrar

1. Sign in as the Dean. Confirm Students, Pipeline, Analytics and Governance are available.
2. Open Pipeline and upload a valid SIS CSV, LMS JSON and Library JSON for one new synthetic student.
3. Confirm imports are staged, then run the pipeline. The master total changes from eight to nine.
4. Open Student 360, search for the new student and open their dossier. Confirm all three feeds are represented.
5. Download the dossier PDF; inspect GPA distribution, program totals and warning indicators in Analytics.
6. Open Present, move to the next slide, close it, then open the course matrix.
7. Sign out and confirm the sign-in form is enabled again.

Result: passed in the browser. The downloaded PDF also passed file-format, page-count and student-metadata validation. API checks additionally covered invalid imports, reports, reset behavior and permission enforcement.

## Academic Advisor

1. Sign in as Advisor. Confirm Students, Analytics and My activity are available, with no Pipeline or Run ETL control.
2. In Analytics, find a student with a critical warning and save an advisor follow-up.
3. Reload, return to Analytics and confirm the follow-up remains saved.
4. Open that student's dossier. Confirm SSN, date of birth and financial-aid restrictions are applied while academic results remain available.
5. Download the masked PDF and open My activity. Confirm the account sees its own events rather than other staff members' history.
6. Sign out.

Result: passed in the browser. PDF validation passed. Server tests independently verified that an advisor cannot run ETL or change their own role.

## Student

1. Start from Student registration with an existing student ID and matching university email.
2. Request a verification link. Confirm the local preview notice and open the generated link.
3. Confirm the password-creation screen appears. Complete activation and reject reuse of the same link.
4. Sign in as the verified student. Confirm the workspace contains only My record, with the linked identity, GPA, standing, courses, attendance and library clearance.
5. Download the personal PDF. Confirm no pipeline, cohort analytics, audit page, staff follow-up, presentation or ETL controls appear.
6. Check the same workspace at mobile width, then sign out and confirm the sign-in form is enabled.

Result: registration request, verification-link screen, sign-in, personal workspace, download and mobile sign-out passed in the browser. Password activation, pre-verification login denial and one-time-link rejection were checked through the API. Real email delivery was not exercised: these tests used private local previews. The synthetic registration addresses are not real student inboxes.

Server tests also rejected another student's record, audit exports, analytics exports and forbidden account-role changes. Internal staff follow-ups are withheld from student responses.

## Compliance Auditor

1. Sign in as Auditor and confirm the initial page is Governance & audit.
2. Review the audit history and integrity indicator. Filter to source imports.
3. Export audit CSV and confirm its header, hashes, import events and follow-up events.
4. Open Masked student summaries and a dossier. Confirm pseudonymized names, masked email and SSN, restricted birth date/financial aid/advisor, and withheld course details.
5. Confirm Pipeline, Run ETL and Academic analytics are unavailable. Sign out.

Result: passed in the browser. CSV validation passed. Server tests independently rejected ETL and analytics exports for the auditor. Auditor summaries are pseudonymized; they retain student IDs and permitted academic summaries.

## Verification and correction

- Role API suite: 49 checks passed through the frontend/backend proxy.
- Registration HTTP suite: 14 checks passed.
- Downloaded artifacts: three valid student PDFs and one valid audit CSV.
- Browser journeys: all four roles completed; student mobile layout, sign-out and classroom presentation navigation checked.
- Fixed during the journey: successful sign-in and sign-out now clear their pending state. Previously, returning to the cached sign-in page could leave the form stuck on “Signing in…”. Repeated desktop and mobile sign-out/sign-in checks passed after the fix.

These results apply to the current local build. The older hosted deployment requires a separate deployment before it receives current interface changes.

## Quality and advising extension — 18 November 2026

These checks used a disposable PostgreSQL schema, synthetic accounts and the production frontend/backend on ports 3005/3006. They did not modify the shared classroom records.

- **Registrar:** opened the four-item quality queue, assigned a Registrar steward, saved an In progress note, and relinked unmatched LMS and Library source identities. ETL published the staged changes and automatically resolved all four associated issues. Resolved history retained the note, staging event and ETL timestamp. Source lineage showed the corrected keys, responsible user and incremented revision. The inline case-creation form exposed real active staff accounts.
- **Academic Advisor:** opened an assigned support case, recorded an internal note, changed Open to In progress, and resolved it with an outcome. Native validation blocked an empty resolution outcome. Reload retained the resolved case. Desktop and 390px mobile forms/history were inspected.
- **Student:** school-ID sign-in still opened only the linked personal record. Quality and Cases navigation were absent.
- **Compliance Auditor:** inspected resolved quality history without stewardship, correction, ETL or case-management controls.
- **Other role boundaries:** HTTP checks covered System Admin denial, department-scoped Dean access, wrong-department rejection, peer-advisor restrictions, inactive assignees, private notes, origin checks and forbidden commands. The browser checks above supplement these server checks; they do not claim a new browser journey for every role.

Verification passed: **31 automated tests, zero skips; 66 workflow HTTP checks; 117 existing role/department HTTP checks; lint; both production builds**. Browser console errors were empty. The responsive extension retains the existing monochrome design, stacks fields on mobile and confines wide tables to their own scroll area.

The independent Impeccable finish review identified two misleading status messages. Successful reload/recheck now clears obsolete staging feedback, and resolved issue descriptions are explicitly labeled as the original finding. Desktop/mobile recaptures and the rebuilt applications confirmed both fixes; the reviewer scored both resolved with disposition **ship**. The existing design tokens, black rail, gray panels, typography, native fields and table behavior were compared with the incumbent system; DESIGN.md was preserved. The detector reported zero primary findings, with existing color/type documentation advisories retained for a separate design-system review.

See [workflow guide](WORKFLOWS.md) for the current role policy and presentation steps. Advising cases require signed-in staff accounts; they do not send emails. The earlier four-role walkthrough above records an older baseline rather than the current six-role policy.

## Concise interface copy — 19 November 2026

Removed account-page introductions and benefit lists, repeated dashboard descriptions and promotional headings. Shortened staff, student, pipeline, quality, case and governance guidance. Warning criteria remain available in an expandable section; field labels, upload/password limits, ETL publishing instructions and consequential-action notices remain visible where needed.

Browser checks used disposable PostgreSQL data: sign-in at 1920px and 390px, mobile registration, recovery, Registrar workspaces, student self-access and the Admin staff form. Sign-in/sign-out, account links and warning-criteria disclosure worked; no console errors were recorded. Lint and production builds passed. Backend behavior and access policy were unchanged.

## Student registration approval — 19 November 2026

Students now enter their name, school ID, department and email. Matching published SIS records retain direct activation after verification. Unlisted IDs require email verification and Registrar approval. Approval creates a Student account without inventing SIS, grades, attendance or library data.

Verification used a disposable PostgreSQL schema and production services on ports 3005/3006: **33 automated tests, zero skips; 41 registration/recovery HTTP checks; lint; both production builds passed**. The checks covered pending-login denial, privileged-field rejection, Registrar-only decisions, duplicate/repeated approvals, rejection and reapplication, late SIS conflicts, consumed tokens, cleared request password hashes, audit events and approved self-access with no academic record.

Browser checks covered desktop/mobile registration fields and the local preview notice, the Registrar queue, review fields, required rejection reason and empty status filter, and approved Student sign-in with only personal account details. Password creation and approval mutations were verified through the API. Browser console errors were empty. No real emails were sent and shared classroom records were not changed. Local preview mode saves eligible links in `backend/.local-email/`; real delivery requires the Resend configuration in [student registration](STUDENT_REGISTRATION.md).

The independent Impeccable finish review returned **ship** for this extension after inspecting eight desktop/mobile captures and the affected components. Existing typography, neutral panels, native fields and inline review behavior were preserved. DESIGN.md and its existing sidecar were left unchanged.
