import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export class EmailUnavailable extends Error {
  constructor() {
    super(
      "Account email is unavailable. Contact your project administrator or try again later.",
    );
  }
}

export function emailConfiguration() {
  const origin = process.env.EDM_PUBLIC_ORIGIN || "http://localhost:3005";
  const url = URL.parse(origin);
  if (
    !url ||
    url.origin !== origin ||
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new EmailUnavailable();
  const local =
    !process.env.VERCEL &&
    !process.env.RAILWAY_PROJECT_ID &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local && url.protocol !== "https:") throw new EmailUnavailable();
  const mode = process.env.EDM_EMAIL_MODE || "resend";
  if (mode === "preview" && local) return { mode: "preview" as const, origin };
  if (mode === "brevo") {
    const apiKey = process.env.BREVO_API_KEY?.trim();
    const from = z.email().safeParse(process.env.EDM_BREVO_FROM_EMAIL?.trim());
    if (apiKey && from.success)
      return { mode, origin, apiKey, from: from.data } as const;
  }
  if (mode === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EDM_EMAIL_FROM;
    if (apiKey && from) return { mode, origin, apiKey, from } as const;
  }
  throw new EmailUnavailable();
}

export async function sendVerificationEmail(email: string, token: string) {
  return sendAccountEmail(email, token, "verification");
}
export async function sendPasswordResetEmail(email: string, token: string) {
  return sendAccountEmail(email, token, "recovery");
}
async function sendAccountEmail(
  email: string,
  token: string,
  purpose: "verification" | "recovery",
) {
  const config = emailConfiguration();
  // Fragment tokens never enter HTTP access logs or Referer headers.
  const link = `${config.origin}/${purpose === "recovery" ? "reset-password" : "register"}#token=${token}`;
  const subject =
    purpose === "recovery"
      ? "Reset your Estante student password"
      : "Verify your Estante student account";
  const text =
    purpose === "recovery"
      ? `${subject}\n\nOpen this link to choose a new password:\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request this reset, ignore this email; your password stays unchanged. After resetting, sign in with your school ID and new password.`
      : `${subject}\n\nOpen this link to choose your password:\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request an account, ignore this email. New school IDs require Registrar approval after verification. Once active, sign in with your school ID and password.`;
  return deliverMessage(config, email, subject, text);
}

export async function sendRegistrationDecisionEmail(
  email: string,
  approved: boolean,
) {
  const config = emailConfiguration();
  const subject = approved
    ? "Your Estante student access is approved"
    : "Your Estante registration request was reviewed";
  const text = approved
    ? `Your student access is approved. Sign in with your school ID and the password you chose:\n${config.origin}/login`
    : "Your registration request was not approved. Contact the registrar to confirm your school details.";
  return deliverMessage(config, email, subject, text);
}

async function deliverMessage(
  config: ReturnType<typeof emailConfiguration>,
  email: string,
  subject: string,
  text: string,
) {
  if (config.mode === "preview") {
    const directory =
      process.env.EDM_EMAIL_PREVIEW_DIR ||
      path.join(process.cwd(), ".local-email");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `${randomUUID()}.txt`),
      `To: ${email}\nSubject: ${subject}\n\n${text}\n`,
      { mode: 0o600, flag: "wx" },
    );
    return;
  }
  const request: {
    url: string;
    headers: Record<string, string>;
    body: object;
  } =
    config.mode === "brevo"
      ? {
          url: "https://api.brevo.com/v3/smtp/email",
          headers: { "api-key": config.apiKey, Accept: "application/json" },
          body: {
            sender: { name: "Estante", email: config.from },
            to: [{ email }],
            subject,
            textContent: text,
          },
        }
      : {
          url: "https://api.resend.com/emails",
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: { from: config.from, to: [email], subject, text },
        };

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...request.headers },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    console.error("Account email provider could not be reached.", config.mode);
    throw new EmailUnavailable();
  }
  if (!response.ok) {
    console.error("Account email provider rejected request.", {
      provider: config.mode,
      status: response.status,
    });
    throw new EmailUnavailable();
  }
}
