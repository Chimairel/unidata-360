# Student registration and verification

Students register themselves at `/register`. Dean / Registrar, Academic Advisor and Compliance Auditor accounts are created by the project administrator using `npm run account:create` from the root. There is no public staff registration or separate administrator dashboard.

## Student flow

1. Import the student's SIS record and run ETL. The master store must contain the student's ID and university email.
2. The student chooses **Create your student account** on the sign-in page and enters those exact details.
3. UniData sends a single-use verification link to the email from the university record. The link expires after 30 minutes. Unknown details and existing accounts receive the same public response.
4. The student opens the link and chooses a password of 12–128 characters. The account is activated as **Student**, linked to that student ID.
5. The student signs in and sees only their own permitted record. An expired link can be replaced from the registration page. Password resets currently go through the project administrator.

The database stores a hash of the verification token. The browser clears the token fragment from its address bar. Activation rechecks the record, prevents duplicate accounts for a student ID, consumes pending links, and appends an audit event in one transaction. Requests have a 60-second cooldown and a limit of five per email/student ID every 15 minutes.

## Real email with Resend

Configure these **backend-only** values in `backend/.env.local` (or the backend host's environment), then restart the backend:

```dotenv
EDM_EMAIL_MODE=resend
RESEND_API_KEY=re_YOUR_REAL_KEY
EDM_EMAIL_FROM=UniData 360 <accounts@YOUR_VERIFIED_DOMAIN>
EDM_PUBLIC_ORIGIN=https://YOUR_FRONTEND_DOMAIN
```

Use an API key and sender domain configured in your own Resend account. UniData cannot generate provider credentials. Delivery errors appear as a sanitized backend log message; the registration response stays generic to avoid exposing the roster. Students should check spam and ask the registrar to confirm details if no message arrives.

Never use a `NEXT_PUBLIC_` prefix for the database URL or Resend key. The frontend calls its own `/api` routes, which proxy to the backend.

## Local classroom email preview

Synthetic seed emails do not belong to real student inboxes. To demonstrate verification locally without sending emails, set:

```dotenv
EDM_EMAIL_MODE=preview
EDM_PUBLIC_ORIGIN=http://localhost:3005
```

Run `npm run dev` from the project root. Each accepted registration saves a text message in `backend/.local-email/`. Open the newest message and copy its complete verification URL into the browser. Set a password, then sign in. The UI explicitly identifies preview delivery. These messages contain temporary links; they are ignored by Git and excluded from deployment packages. Delete old previews after presenting.

Preview delivery is restricted to loopback frontend origins and disabled on Vercel and Railway. Production requires real email configuration. For real registration, SIS email addresses must be mailboxes students can access; do not send to the synthetic seed addresses.

## Verification

`npm test` includes registration, role-injection, duplicate activation, expiry, changed-roster, throttling, delivery-failure and Resend-request tests. Database tests require an isolated `EDM_TEST_DATABASE_URL`. `npm run test:registration` checks signup through the running production frontend/backend proxy with a fresh isolated database and private temporary email previews. No real emails are sent by these tests.
