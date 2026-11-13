# UniData 360 MVP journeys

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
