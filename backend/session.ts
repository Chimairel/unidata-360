import { cookies } from "next/headers";
import { accountsRequired, issueSession, readSession } from "./auth";

export class AuthenticationRequired extends Error {
  constructor() {
    super("Sign in to continue.");
  }
}
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  secure:
    process.env.VERCEL === "1" || process.env.EDM_SECURE_COOKIES === "true",
};
export async function session() {
  const jar = await cookies();
  const existing = await readSession(jar.get("unidata_session")?.value);
  if (existing) return existing;
  if (accountsRequired()) throw new AuthenticationRequired();
  const issued = await issueSession("REGISTRAR");
  jar.set("unidata_session", issued.token, {
    ...sessionCookieOptions,
    maxAge: issued.maxAge,
  });
  return (await readSession(issued.token))!;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Use the configured external origin behind an HTTPS-terminating proxy.
  // Do not derive this allowlist from client-controlled forwarding headers.
  const publicOrigin =
    process.env.EDM_PUBLIC_ORIGIN ||
    (!process.env.VERCEL && !process.env.RAILWAY_PROJECT_ID
      ? "http://localhost:3005"
      : undefined);
  if (
    (publicOrigin || process.env.VERCEL === "1"
      ? origin !== publicOrigin
      : origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new Error("Cross-origin write requests are not allowed.");
}
