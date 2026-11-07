# UniData 360 demo accounts

The development and online PostgreSQL databases each contain these four synthetic accounts.

| Role | Email | Access |
| --- | --- | --- |
| Dean / Registrar | registrar@unidata.example | Import data, run ETL, view records, and export reports. |
| Academic Advisor | advisor@unidata.example | View masked student records and create advisor follow-ups. |
| Student | student@unidata.example | View and export the linked student record, STU-2024-001. |
| Compliance Auditor | auditor@unidata.example | View restricted student projections and export audit history. |

## Password files

On the original development device, this folder also contains:

- `development.private.txt` for sign-in at http://localhost:3005/login, using the shared development database.
- `online.private.txt` for sign-in at https://unidata-360.vercel.app/login.

Each database has its own account passwords. These files are excluded from Git. Share the appropriate file privately with your group and save it in this folder on the other device.

For local development, place the shared development connection settings in `backend/.env.local`. An account signs into the database selected by the backend's `DATABASE_URL`.

To create accounts in another PostgreSQL database, configure that database connection and run `npm run account:create` from the project root. Run `npm run account:password` to reset a password. Creating or resetting an account updates PostgreSQL. Keep the corresponding private password file current.
