# Student registration, school ID sign-in and recovery

Students register themselves at `/register`. Registrar, department-assigned Dean, Academic Advisor and Compliance Auditor accounts are created by System Admin in the Accounts dashboard. The CLI remains available for initial setup and recovery. There is no public staff registration.

## Student flow

1. Enter full name, school ID, email and one of BSIT/BEED/BSED/BSHM at `/register`.
2. UniData prepares a single-use verification link, valid for 30 minutes. A school ID already in the master must match its SIS email; self-entered details do not replace that school record. Existing accounts and ineligible details receive a generic public response.
3. Open the link and choose a 12–128-character password. Matching published SIS students activate directly. Unlisted IDs become **Pending** verified requests; they cannot sign in yet.
4. Registrar opens **Student 360 → Student registration requests**, confirms enrollment and approves or rejects the request. Other roles, including System Admin, cannot review it. Rejection requires an internal reason; decisions are audited and an email notification is prepared.
5. Approved students sign in with **school ID + password**. Approval creates only the account. Until SIS data is imported and ETL runs, the student sees their approved account identity and an academic-records-pending message; no grades, attendance or clearance are fabricated.

The Registrar checks any SIS record published while a request was pending. Conflicting email/department details block approval. Request password hashes are cleared after approval/rejection. Rejected students may submit a fresh verified request; previous decisions remain recorded. If a decision notification fails, the approved account remains usable and the Registrar is told to contact the student.

A personal Gmail address is accepted; existing SIS students must use the email on that record. This does not implement Google sign-in. Email is used for verification and recovery, not as the student login name. School-ID sign-in ignores letter case and surrounding spaces; passwords remain case-sensitive.

## Student password recovery

1. Choose **Forgot your student password?** or open `/reset-password`.
2. Enter the school ID and registered account email. Unknown IDs, mismatches and staff accounts receive the same public response.
3. Open the emailed link and choose a new 12–128-character password. The link expires after 30 minutes and can be used once.
4. Sign in with the school ID and new password. All previous sessions are revoked, login lockouts are cleared, and a password-reset audit event is appended.

Recovery tokens are hashed and bound to the registered account email. An expired, undelivered, consumed or registration-verification token cannot reset a password. Changing the registered email invalidates pending recovery links. Administrator password resets also clear pending recovery tokens. Requests have a 60-second cooldown and a five-request/15-minute limit per school ID/email. Staff recovery stays with System Admin through the Accounts dashboard; protected Admin accounts use the local CLI.

The database stores a hash of the verification token. The browser clears the token fragment from its address bar. Activation rechecks the record, prevents duplicate accounts for a student ID, consumes pending links, and appends an audit event in one transaction. Requests have a 60-second cooldown and a limit of five per email/student ID every 15 minutes.

## Real email with Brevo

In Brevo, [verify a sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email) and [create an API key](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys) with permission to send transactional email. Use the sender's email address and keep the key in the backend environment.

```dotenv
EDM_EMAIL_MODE=brevo
BREVO_API_KEY=YOUR_BREVO_API_KEY
EDM_BREVO_FROM_EMAIL=accounts@YOUR_VERIFIED_DOMAIN
EDM_PUBLIC_ORIGIN=https://YOUR_FRONTEND_DOMAIN
```

Save these in `backend/.env.local` and restart the backend. For testing on this computer, set `EDM_PUBLIC_ORIGIN=http://localhost:3005` and open the email link here. For the hosted app, put the variables in Railway and use the public Vercel origin. Brevo's [HTTPS endpoint](https://developers.brevo.com/reference/send-transac-email) works with [Railway's SMTP restrictions](https://docs.railway.com/networking/outbound-networking).

Submit a registration using an unused school ID and an inbox you can access. Check the [Brevo transactional logs](https://help.brevo.com/hc/en-us/articles/360021533839-Manage-your-transactional-logs-and-email-previews) if the message is delayed, then open the link and confirm the expected account status. Use a fresh registration after switching from preview mode.

## Real email with Resend

Configure these **backend-only** values in `backend/.env.local` (or the backend host's environment), then restart the backend:

```dotenv
EDM_EMAIL_MODE=resend
RESEND_API_KEY=re_YOUR_REAL_KEY
EDM_EMAIL_FROM=UniData 360 <accounts@YOUR_VERIFIED_DOMAIN>
EDM_PUBLIC_ORIGIN=https://YOUR_FRONTEND_DOMAIN
```

Use an API key and sender domain configured in your own Resend account. UniData cannot generate provider credentials. Delivery errors appear as a sanitized backend log message; the registration response stays generic to avoid exposing the roster. Students should check spam and ask the registrar to confirm details if no message arrives.

Keep the database URL and email provider keys in the backend environment. The frontend calls its own `/api` routes, which proxy to the backend.

## Local classroom email preview

Synthetic seed emails do not belong to real student inboxes. To demonstrate verification locally without sending emails, set:

```dotenv
EDM_EMAIL_MODE=preview
EDM_PUBLIC_ORIGIN=http://localhost:3005
```

Run `npm run dev` from the project root. Each eligible registration or recovery request saves a text message in `backend/.local-email/`. **Preview mode sends no inbox email.** Open the newest message and copy its complete verification URL into the browser. Set a password, then follow the account status shown; unlisted IDs still require Registrar approval. The UI explicitly says **Local email preview**. Decision notifications are saved locally too. These private messages are ignored by Git and excluded from deployments.

Preview delivery is restricted to loopback frontend origins and disabled on Vercel and Railway. Production requires real email configuration. For real registration, SIS email addresses must be mailboxes students can access; do not send to the synthetic seed addresses.

## Verification

`npm test` includes registration, role-injection, duplicate activation, expiry, changed-roster, throttling, delivery failures and mocked Brevo and Resend requests. Database tests require an isolated `EDM_TEST_DATABASE_URL`. `npm run test:registration` checks signup, school ID login, password recovery and session revocation through the running production frontend/backend proxy with a fresh isolated database and private temporary email previews. No real emails are sent by these tests.
