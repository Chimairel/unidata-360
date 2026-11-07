# UniData 360 demo accounts

Students may also [register themselves](../docs/STUDENT_REGISTRATION.md) using an existing university student ID and matching email, then activate their account through email verification. Staff accounts are created by the project administrator with the CLI. The Dean / Registrar is an application role, separate from the person who provisions accounts.

Local and online UniData use the same PostgreSQL database and these four synthetic accounts.

| Role | Email | Access |
| --- | --- | --- |
| Dean / Registrar | dean@cpc.edu | Import data, run ETL, view records, and export reports. |
| Academic Advisor | advisor@cpc.edu | View masked student records and create advisor follow-ups. |
| Student | student@cpc.edu | View and export the linked student record, STU-2024-001. |
| Compliance Auditor | auditor@cpc.edu | View restricted student projections and export audit history. |

## Password files

On the original device, `shared.private.txt` holds the passwords for both http://localhost:3005/login and https://unidata-360.vercel.app/login. This file is excluded from Git; share it privately with your group. The `development.private.txt` and `online.private.txt` files on the original device are also updated copies of the shared credentials; older copies on other devices are no longer current.

For local use, place the shared database connection settings in `backend/.env.local` on each device. The shared `.env.local` is excluded from Git and must be transferred privately. Changes made locally are visible online because they use the same database.

To create accounts in another PostgreSQL database, configure that database connection and run `npm run account:create` from the project root. Run `npm run account:password` to reset a password. Creating or resetting an account updates PostgreSQL. Keep the corresponding private password file current.
