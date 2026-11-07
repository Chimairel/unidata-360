import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export class EmailUnavailable extends Error {
  constructor() {
    super(
      "Verification email is unavailable. Contact your project administrator or try again later.",
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
  if (
    mode !== "resend" ||
    !process.env.RESEND_API_KEY ||
    !process.env.EDM_EMAIL_FROM
  )
    throw new EmailUnavailable();
  return { mode: "resend" as const, origin };
}

export async function sendVerificationEmail(email: string, token: string) {
  const config = emailConfiguration();
  // Fragment tokens never enter HTTP access logs or Referer headers.
  const link = `${config.origin}/register#token=${token}`;
  const text = `Verify your UniData 360 student account\n\nOpen this link to choose your password:\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request an account, ignore this email. No account is activated until verification is complete.`;
  if (config.mode === "preview") {
    const directory =
      process.env.EDM_EMAIL_PREVIEW_DIR ||
      path.join(process.cwd(), ".local-email");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, `${randomUUID()}.txt`),
      `To: ${email}\nSubject: Verify your UniData 360 student account\n\n${text}\n`,
      { mode: 0o600, flag: "wx" },
    );
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EDM_EMAIL_FROM,
        to: [email],
        subject: "Verify your UniData 360 student account",
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new EmailUnavailable();
  } catch {
    throw new EmailUnavailable();
  }
}
