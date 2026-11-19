# Student account activation and recovery

## Registrar enrollment

Sign in as Registrar and upload a SIS CSV or JSON file in **Pipeline**. The import creates pending accounts for active students with a unique school ID and email. Import the same roster again to update SIS records and preserve existing credentials. Run ETL to publish the records to Student 360. For rosters already stored in Estante, open **Student 360 → Student accounts → Provision from SIS**.

Rows with conflicting IDs or emails need Registrar review. If a current SIS upload changes the email of a pending student, activation waits until the Registrar verifies the student’s identity and corrects their email in **Student accounts**. That form updates the account and the SIS source if present. Changing an account email invalidates its outstanding links and sessions. Run ETL to publish corrections to the master view.

## First sign-in

1. Select **Activate student account** and enter the school ID and enrollment email. The screen returns the same response whether or not the details match.
2. Open the single-use email link within 30 minutes and set your first password. Pending accounts have no password and cannot sign in or access records.
3. Sign in with the school ID and new password. Student 360 shows the linked record after ETL publishes it.

Previous self-registration requests are available as read-only history in the Registrar workspace. To enroll a student with an archived request, import their verified SIS record and have them activate through the new flow. Previously activated students can keep using their existing passwords.

## Student password recovery

Active students can select **Forgot student password?** and enter their school ID and registered email. The single-use reset link expires after 30 minutes. Resetting a password revokes prior sessions. If the inbox is unavailable, the Registrar verifies the student’s identity before correcting the address.

Both flows store only token hashes, rate-limit requests, and use different tokens. The browser clears the link token from the address bar. Admin creates staff accounts in **Accounts**.

## Real email with Brevo

In Brevo, [verify a sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email) and [create an API key](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys) with permission to send transactional email. Use the sender's email address and keep the key in the backend environment.

```dotenv
EDM_EMAIL_MODE=brevo
BREVO_API_KEY=YOUR_BREVO_API_KEY
EDM_BREVO_FROM_EMAIL=accounts@YOUR_VERIFIED_DOMAIN
EDM_PUBLIC_ORIGIN=https://YOUR_FRONTEND_DOMAIN
```

Save these in `backend/.env.local` and restart the backend. For testing on this computer, set `EDM_PUBLIC_ORIGIN=http://localhost:3005` and open the email link here. For the hosted app, put the variables in Railway and use the public Vercel origin. Brevo's [HTTPS endpoint](https://developers.brevo.com/reference/send-transac-email) works with [Railway's SMTP restrictions](https://docs.railway.com/networking/outbound-networking).

Import a synthetic student record with a new school ID and an inbox you can access, then request activation. Check the [Brevo transactional logs](https://help.brevo.com/hc/en-us/articles/360021533839-Manage-your-transactional-logs-and-email-previews) if the message is delayed, then open the link and set a password. Request a fresh activation link after switching from preview mode.

## Real email with Resend

Configure these **backend-only** values in `backend/.env.local` (or the backend host's environment), then restart the backend:

```dotenv
EDM_EMAIL_MODE=resend
RESEND_API_KEY=re_YOUR_REAL_KEY
EDM_EMAIL_FROM=Estante <accounts@YOUR_VERIFIED_DOMAIN>
EDM_PUBLIC_ORIGIN=https://YOUR_FRONTEND_DOMAIN
```

Use an API key and sender domain configured in your own Resend account. Estante cannot generate provider credentials. Delivery errors appear as a sanitized backend log message; the registration response stays generic to avoid exposing the roster. Students should check spam and ask the registrar to confirm details if no message arrives.

Keep the database URL and email provider keys in the backend environment. The frontend calls its own `/api` routes, which proxy to the backend.

## Local classroom email preview

Synthetic seed emails do not belong to real student inboxes. To demonstrate verification locally without sending emails, set:

```dotenv
EDM_EMAIL_MODE=preview
EDM_PUBLIC_ORIGIN=http://localhost:3005
```

Run `npm run dev` from the project root. Each eligible activation or recovery request saves a text message in `backend/.local-email/`. **Preview mode sends no inbox email.** Open the newest message and copy its complete verification URL into the browser. Set a password, then sign in with the school ID. The UI explicitly says **Local email preview**. These private messages are ignored by Git and excluded from deployments.

Preview delivery is restricted to loopback frontend origins and disabled on Vercel and Railway. Production requires real email configuration. For real activation, SIS email addresses must be mailboxes students can access; do not send to the synthetic seed addresses.

## Verification

`npm test` covers provisioned accounts, permission checks, repeat imports, link expiry, email corrections, and mocked Brevo and Resend requests. Database tests require an isolated `EDM_TEST_DATABASE_URL`. `npm run test:registration` checks enrollment import, activation, school ID login, password recovery and session revocation through the running production frontend/backend proxy with a fresh isolated database and private temporary email previews. No real emails are sent by these tests.
