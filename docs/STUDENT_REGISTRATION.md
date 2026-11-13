# Student registration, school ID sign-in and recovery

Students register themselves at `/register`. Registrar, department-assigned Dean, Academic Advisor and Compliance Auditor accounts are created by the project administrator using `npm run account:create` from the root. There is no public staff registration or separate administrator dashboard.

## Student flow

1. Import the student's SIS record and run ETL. The master store must contain the student's school ID and email.
2. The student chooses **Create your student account** on the sign-in page and enters those exact details.
3. UniData sends a single-use verification link to the email from the school record. The link expires after 30 minutes. Unknown details and existing accounts receive the same public response.
4. The student opens the link and chooses a password of 12–128 characters. The account is activated as **Student**, linked to that student ID.
5. The student signs in with **school ID + password** and sees only their own permitted record. Staff continue using their assigned email + password. An expired link can be replaced from the registration page. Existing student accounts keep their current password.

A personal Gmail address is accepted for registration when it matches the email in the school record; this does not implement Google sign-in. Student emails are used for verification and recovery, not as login names. The login field accepts school IDs regardless of letter case and trims surrounding spaces. Passwords remain case-sensitive.

## Student password recovery

1. Choose **Forgot your student password?** or open `/reset-password`.
2. Enter the school ID and registered account email. Unknown IDs, mismatches and staff accounts receive the same public response.
3. Open the emailed link and choose a new 12–128-character password. The link expires after 30 minutes and can be used once.
4. Sign in with the school ID and new password. All previous sessions are revoked, login lockouts are cleared, and a password-reset audit event is appended.

Recovery tokens are hashed and bound to the registered account email. An expired, undelivered, consumed or registration-verification token cannot reset a password. Changing the registered email invalidates pending recovery links. Administrator password resets also clear pending recovery tokens. Requests have a 60-second cooldown and a five-request/15-minute limit per school ID/email. Staff recovery stays with the project administrator.

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

Run `npm run dev` from the project root. Each eligible registration or recovery request saves a text message in `backend/.local-email/`. Open the newest message and copy its complete verification URL into the browser. Set a password, then sign in with the school ID. The UI explicitly identifies preview delivery. These messages contain temporary links; they are ignored by Git and excluded from deployment packages. Delete old previews after presenting.

Preview delivery is restricted to loopback frontend origins and disabled on Vercel and Railway. Production requires real email configuration. For real registration, SIS email addresses must be mailboxes students can access; do not send to the synthetic seed addresses.

## Verification

`npm test` includes registration, role-injection, duplicate activation, expiry, changed-roster, throttling, delivery-failure and Resend-request tests. Database tests require an isolated `EDM_TEST_DATABASE_URL`. `npm run test:registration` checks signup, school ID login, password recovery and session revocation through the running production frontend/backend proxy with a fresh isolated database and private temporary email previews. No real emails are sent by these tests.
