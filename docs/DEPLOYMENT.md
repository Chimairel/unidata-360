# Host UniData 360

The production deployment uses [unidata-360.vercel.app](https://unidata-360.vercel.app) for the Next.js application and Neon PostgreSQL for persistent storage. Next.js route handlers connect to Neon over verified TLS. Browser requests use a first-party, secure session cookie. Local development continues on port **3005**.

## Deploy directly to Vercel

Use the **Next.js** framework preset and **Node.js 24.x**. Configure `DATABASE_URL` as a sensitive production variable with the pooled Neon connection string. Set `EDM_PUBLIC_ORIGIN` to the exact production HTTPS origin without a trailing slash. The Vercel runtime requires account sign-in and PostgreSQL, and issues secure cookies.

```powershell
$app = & .\scripts\package-hosted.ps1 -Platform Vercel
vercel link --cwd $app --project unidata-360 --yes
vercel deploy --cwd $app --prod --yes
```

The staging script copies only the build configuration, source and public assets. The app initializes its schema and loads eight synthetic students on first use. Verify `/api/health` returns 200, `/api/edm` returns 401 before sign-in, and `/login` loads in a browser.

### Provision Vercel users

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

Choose `DEAN_REGISTRAR` for a registrar. Student accounts require their own existing student ID. The password prompt hides input. Run `npm run account:password` with the same environment to reset a provisioned password and revoke its sessions.

## Optional Railway app server

To use Railway as the Next.js runtime, deploy the Dockerfile on port **3005** and configure Vercel as a reverse proxy to the Railway HTTPS origin. This configuration uses an **Other** Vercel project with rewrite caching disabled for API requests.

### Set up the services

1. Create a dedicated Neon project and database. The server initializes its schema and seeds eight synthetic students on first use. Use the pooled PostgreSQL connection string for the production branch.
2. Create a Vercel project with the **Other** framework preset and identify its canonical production domain. The origin must be exactly `https://<production-domain>`.
3. Create a dedicated Railway project and an empty service. Use the Dockerfile in the staged upload and enable a Railway HTTPS domain with target port **3005**. Configure the service's healthcheck path as `/api/health`.
4. Set these service variables in Railway:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Pooled Neon connection string. Store it as a secret in Railway. |
   | `EDM_PUBLIC_ORIGIN` | The Vercel production HTTPS origin, without a trailing slash. |
   | `EDM_AUTH_MODE` | `accounts` (Dockerfile default). |
   | `EDM_SECURE_COOKIES` | `true` (Dockerfile default). |
   | `PORT` | `3005` (Dockerfile default). |

   The Vercel project only needs the Railway HTTPS address.

### Deploy

Run these commands from the workspace in PowerShell. The generated packages include the application source and the Vercel routing configuration. Local database backups, credentials and course documents are excluded.

```powershell
$app = & .\scripts\package-hosted.ps1
railway up $app --path-as-root --project <railway-project-id> --service <railway-service> --environment production --detach

$ingress = node scripts/package-ingress.mjs https://<service>.up.railway.app
vercel link --cwd $ingress --project <vercel-project> --yes
vercel deploy --cwd $ingress --prod --yes
```

Use the canonical Vercel production domain for sign-in. If Vercel assigns a different production domain, update `EDM_PUBLIC_ORIGIN` in Railway and redeploy that service.

### Provision accounts and verify

1. Open an interactive terminal to the running Railway service with `railway ssh` and run `cd /app && npm run account:create`. Enter the user's email, name, role and password when prompted. For a registrar, choose `DEAN_REGISTRAR`. Each student account requires its own existing student ID.
2. Open `/api/health` on the Vercel domain. Expect HTTP 200 and `{"status":"ok"}`. An unauthenticated request to `/api/edm` should return HTTP 401. Use `/login` to sign in with the provisioned account.
3. With a class test account, verify its access to Student 360 and its allowed reports. Check a small synthetic upload, run ETL as registrar, and confirm the change persists after a reload.
4. To reset a password, run `cd /app && npm run account:password` in the Railway shell. This revokes that user's sessions.

## Verify PostgreSQL changes

For an isolated Neon verification branch, set `EDM_TEST_DATABASE_URL` to that branch's pooled connection string, build the app, free local port 3005, and run `npm run test:auth -- --hosted`. This creates synthetic users and tests audit concurrency, append-only enforcement, transaction rollback, origin checks, role restrictions and sign-in over the configured hosted-origin policy. Run it against a fresh, empty test database each time.
