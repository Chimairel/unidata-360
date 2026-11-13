# School departments and staff roles

UniData uses the four departments supplied by the group:

| Department | Program |
| --- | --- |
| BSIT | Bachelor of Science in Information Technology |
| BEED | Bachelor of Elementary Education |
| BSED | Bachelor of Secondary Education |
| BSHM | Bachelor of Science in Hospitality Management |

Program names and sample courses are classroom examples, not a verified school curriculum. GPA still uses the demonstration's existing 0–4 scale; no school grading policy was supplied.

## Responsibilities

- **Registrar:** school-wide student records, SIS/LMS/Library ingestion, ETL, analytics, follow-ups and system audit. This is separate from the project administrator who provisions accounts.
- **Dean:** one assigned department. Starts in department analytics and may open that department's masked student dossiers, download its reports, save follow-ups and inspect their own activity. No imports, ETL, demo reset, raw source feeds or school-wide ETL reports.
- **Academic Advisor:** academic records, analytics, follow-ups and personal activity across the current permitted school dataset. Advisors have not been given department restrictions in this version.
- **Student:** own linked record and personal report only.
- **Compliance Auditor:** pseudonymized student summaries and system audit/export. No academic analytics or changes to data.

Dean filtering happens before records reach the browser. Counts, follow-ups, JSON/PDF exports and analytics use the same scope. Direct attempts to open or export another department's student return 404; forbidden commands or department analytics return 403. An account cannot select another role or department. A Dean account missing a valid assignment cannot establish an authorized session.

The directory supports department search/filtering. Registrar/advisor analytics can be filtered to one department; the downloaded analytics PDF follows that selection. A Dean's report remains confined to the assigned department.

## Upgrade the existing classroom database

Update both application folders before using the changed accounts:

```powershell
git pull
npm ci
npm run school:setup
npm run dev
```

Keep the existing shared PostgreSQL connection in `backend/.env.local`. Stop running servers before updating. `school:setup` is repeatable and:

1. Maps the eight original synthetic student IDs to two students per department and replaces their generic program names. Existing performance metrics, imported students, student IDs and account links are preserved.
2. Updates the original sample course codes/names to relevant illustrative courses, preserving learning metrics.
3. Separates the existing `dean@cpc.edu` into a BSIT Dean and provisions `registrar@cpc.edu` plus three additional department Deans. Existing advisor, student and auditor accounts remain.
4. Preserves existing password hashes; generates passwords only for missing synthetic accounts. Changed staff assignments revoke old sessions.
5. Writes the private account guide to `accounts/shared.private.txt` and its local/online copies. Those files remain excluded from Git. Existing passwords are recovered from the local private guide when available; otherwise the guide tells the administrator to use the existing password or reset it.
6. Retains audit history and ETL reports. The old `DEAN_REGISTRAR` role is migrated to `REGISTRAR`; historical audit payloads and hashes stay unchanged.

Only one device needs to run the upgrade against the shared database. Transfer the refreshed private account guide to the presentation device; Git carries the code and public email list. The hosted application needs the current code before these new roles are used online. Hosting deployment remains a separate step.

For additional staff, run `npm run account:create`; a `DEAN` requires a department code. Students continue to self-register using their matching existing student ID and email.

## Classroom demo mode

The persona picker offers Registrar and Dean separately. Its Dean persona uses BSIT as a fixed demonstration department. Use the four actual synthetic Dean accounts to demonstrate all department boundaries. Account mode does not permit persona switching.
