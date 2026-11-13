# UniData 360 demo accounts

Students may also [register themselves](../docs/STUDENT_REGISTRATION.md) using an existing university student ID and matching email, then activate their account through email verification. Staff accounts are created by the project administrator with the CLI. Registrar and Dean are application roles, separate from the person who provisions accounts.

Local and online UniData use the same PostgreSQL database and these eight synthetic accounts across five roles.

| Role | Email | Access |
| --- | --- | --- |
| Registrar | registrar@cpc.edu | School-wide records, imports, ETL and system audits. |
| BSIT Dean | dean@cpc.edu | BSIT academic records, analytics and follow-ups. |
| BEED Dean | dean.beed@cpc.edu | BEED academic records, analytics and follow-ups. |
| BSED Dean | dean.bsed@cpc.edu | BSED academic records, analytics and follow-ups. |
| BSHM Dean | dean.bshm@cpc.edu | BSHM academic records, analytics and follow-ups. |
| Academic Advisor | advisor@cpc.edu | View masked student records and create advisor follow-ups. |
| Student | student@cpc.edu | View and export the linked student record, STU-2024-001. |
| Compliance Auditor | auditor@cpc.edu | View restricted student projections and export audit history. |

Run `npm run school:setup` once against the shared database to upgrade the classroom accounts and synthetic departments. Existing passwords are preserved; new passwords are written only to the private files below. The existing `dean@cpc.edu` becomes the BSIT Dean. See [school setup](../docs/SCHOOL_SETUP.md).

## Password files

On the original device, `shared.private.txt` holds the passwords for both http://localhost:3005/login and https://unidata-360.vercel.app/login. This file is excluded from Git; share it privately with your group. The `development.private.txt` and `online.private.txt` files on the original device are also updated copies of the shared credentials; older copies on other devices are no longer current.

For local use, place the shared database connection settings in `backend/.env.local` on each device. The shared `.env.local` is excluded from Git and must be transferred privately. Changes made locally are visible online because they use the same database.

To create accounts in another PostgreSQL database, configure that database connection and run `npm run account:create` from the project root. Run `npm run account:password` to reset a password. Creating or resetting an account updates PostgreSQL. Keep the corresponding private password file current.
