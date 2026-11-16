# System Admin and staff accounts

System Admin manages staff access in the app. Registrar manages official student data; Deans oversee their departments. System Admin has no student directory, pipeline, academic analytics, student PDF/JSON reports or full governance report. Student registration and personal email recovery are unchanged.

## First-time setup

With the existing shared PostgreSQL settings in `backend/.env.local`:

```powershell
npm run admin:setup
npm run dev
```

The setup command provisions the synthetic `admin@cpc.edu` account, generates a strong password and stores it in Git-ignored `accounts/admin.private.txt`. It also appends the credentials to the local shared/development/online private guides. Existing passwords are preserved. Repeating the command does not reset the Admin password or create a duplicate.

Sign in at `http://localhost:3005/login` using that email and password. The Admin opens directly into **Accounts**. Transfer the private guide separately to the presentation device; Git contains only code and public account descriptions. A shared database needs provisioning only once. The hosted application must receive the current code separately.

## Everyday tasks

- **Create staff account:** enter the full name, email, role, initial password and confirmation. A Dean requires BSIT, BEED, BSED or BSHM. Share the sign-in details privately. This action does not send an invitation email.
- **Edit access:** change the display name, role or Dean department. Existing sessions are revoked, so the staff member signs in again with their current password.
- **Disable / activate:** confirm the selected staff email. Disabling signs out sessions and prevents sign-in; activation restores access without changing the password. Accounts are not deleted.
- **Reset password:** enter and confirm a new 12–128-character password. Previous sessions and pending recovery tokens are revoked. Existing passwords cannot be retrieved or viewed.
- **Account activity:** inspect staff account changes and Admin sign-in/access events. No password or password hash appears in this history.

Students are excluded from the staff directory and management API. They keep their own school ID registration/recovery flow. The four managed staff roles are Registrar, Dean, Academic Advisor and Compliance Auditor.

## Protected administrator accounts

The web form cannot create, promote, edit, disable or reset a System Admin, including the signed-in Admin itself. This avoids losing administrator access through routine staff management. Provision additional administrators with `npm run account:create` and role `SYSTEM_ADMIN`; recover an administrator password with `npm run account:password`. These commands require access to the local backend environment.

The classroom persona picker cannot become System Admin. A real active account session is required. API authorization is checked independently of navigation and is rechecked against the stored Admin role before writes. All account mutations validate an allowed frontend origin, run transactionally and append audit events. Staff role/status changes revoke existing sessions immediately for subsequent requests.

## Verification

`npm run test:admin` requires a disposable, isolated `EDM_TEST_DATABASE_URL`, production builds and free ports 3005/3006. It starts both services, verifies all six role boundaries, exercises the staff account lifecycle and checks protected accounts, student-data denial and audit integrity. Test passwords are synthetic and kept out of console output.
