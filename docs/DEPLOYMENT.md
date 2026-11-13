# Host UniData 360

The production deployment uses [unidata-360.vercel.app](https://unidata-360.vercel.app) for the Next.js application and Neon PostgreSQL for persistent storage. Next.js route handlers connect to Neon over verified TLS. Browser requests use a first-party, secure session cookie. Local development continues on port **3005**.

## Independent applications

The source now has two npm workspaces. The frontend starts on port **3005** and forwards API requests to the backend on port **3006**. For cloud hosting, deploy the frontend to Vercel and the backend container to Railway. Set the Vercel project's **Root Directory** to `frontend` and enable access to source files outside the root directory so it can use `shared/` and the root lockfile. Set `BACKEND_URL` to the backend HTTPS origin before building the frontend.

The backend's environment contains `DATABASE_URL`, `EDM_PUBLIC_ORIGIN`, `EDM_AUTH_MODE=accounts`, and `EDM_SECURE_COOKIES=true`. Only the backend connects to Neon. The production hostname above currently uses the earlier deployment. Deploying this new two-service source requires configuring the separate backend and frontend services.

Student self-registration also requires backend `EDM_EMAIL_MODE=resend`, `RESEND_API_KEY` and `EDM_EMAIL_FROM` with a verified sender domain. See [student registration setup](STUDENT_REGISTRATION.md). Public student registration activates only the Student role; the account CLI remains the way to create staff accounts. Local email preview is excluded from hosted packages and cannot run on hosted origins.

### Provision users

From the workspace, run the account CLI in a trusted interactive terminal with `DATABASE_URL` pointing to the production Neon database. The connection string is a server secret. Supply it through the current terminal's environment and clear it after provisioning. If authenticated with Neon CLI, replace the project ID placeholder with the ID shown in your Neon project settings:

```powershell
$connection = [string](neon connection-string main --project-id YOUR_NEON_PROJECT_ID --database-name unidata --pooled)
if ($LASTEXITCODE -ne 0 -or !$connection.StartsWith('postgres')) {
  throw 'Unable to get the production database connection. Check your Neon CLI login.'
}
try {
  $env:DATABASE_URL = $connection.Trim()
  $env:EDM_PUBLIC_ORIGIN = 'https://unidata-360.vercel.app'
  npm run account:create
} finally {
  Remove-Item Env:DATABASE_URL, Env:EDM_PUBLIC_ORIGIN -ErrorAction SilentlyContinue
  Remove-Variable connection
}
```

Choose `REGISTRAR` for a registrar. Student accounts require their own existing student ID. The password prompt hides input. Run `npm run account:password` with the same environment to reset a provisioned password and revoke its sessions.

## Split the frontend and API with Railway

Deploy the Next.js API on Railway using the Dockerfile on port **3006**. Deploy the interface to the **Next.js** project on Vercel. The frontend application serves pages and static assets. It forwards `/api/*` to Railway on the existing Vercel domain and disables rewrite caching for those requests, so session cookies stay first-party.

### Set up the services

1. Use the existing Neon database to retain the current accounts and records. The server initializes and seeds the database only if it is empty.
2. Identify the canonical production domain of the **Next.js** project in Vercel with Root Directory `frontend`. The origin must be exactly `https://<production-domain>`.
3. Create a dedicated Railway project and an empty service. Use the Dockerfile in the staged upload and enable a Railway HTTPS domain with target port **3006**. Configure the service's healthcheck path as `/api/health`.
4. Set these service variables in Railway:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Pooled Neon connection string. Store it as a secret in Railway. |
   | `EDM_PUBLIC_ORIGIN` | The Vercel production HTTPS origin, without a trailing slash. |
   | `EDM_AUTH_MODE` | `accounts` (Dockerfile default). |
   | `EDM_SECURE_COOKIES` | `true` (Dockerfile default). |
   | `PORT` | `3006` (Dockerfile default). |

   The split frontend only needs the Railway HTTPS address. Keep the last working Vercel deployment available for rollback.

### Deploy

Run these commands from the workspace in PowerShell. The generated packages include the application source and the Vercel routing configuration. Local database backups, credentials and course documents are excluded.

```powershell
$app = & .\scripts\package-hosted.ps1
railway up $app --path-as-root --project <railway-project-id> --service <railway-service> --environment production --detach

# In Vercel, set Root Directory to frontend, BACKEND_URL to the Railway HTTPS
# origin, and deploy this repository with shared source access enabled.
```

Check Railway's `/api/health` for a 200 response before promoting the frontend with `vercel promote <deployment-url>`. Verify sign-in and an authenticated dashboard request on the canonical domain after promotion. If either check fails, roll back the Vercel deployment while investigating.

### Provision accounts and verify

1. Open an interactive terminal to the running Railway service with `railway ssh` and run `cd /app && npm run account:create`. Enter the user's email, name, role and password when prompted. For a registrar, choose `REGISTRAR`. Each student account requires its own existing student ID.
2. Open `/api/health` on the Vercel domain. Expect HTTP 200 and `{"status":"ok"}`. An unauthenticated request to `/api/edm` should return HTTP 401. Use `/login` to sign in with the provisioned account.
3. With a class test account, verify its access to Student 360 and its allowed reports. Check a small synthetic upload, run ETL as registrar, and confirm the change persists after a reload.
4. To reset a password, run `cd /app && npm run account:password` in the Railway shell. This revokes that user's sessions.

## Verify PostgreSQL changes

For an isolated Neon verification branch, set `EDM_TEST_DATABASE_URL` to that branch's pooled connection string, build the app, free local ports 3005 and 3006, and run `npm run test:auth -- --hosted`. This creates synthetic users and tests audit concurrency, append-only enforcement, transaction rollback, origin checks, role restrictions and sign-in over the configured hosted-origin policy. Run it against a fresh, empty test database each time.
