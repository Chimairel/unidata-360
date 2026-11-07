import { cookies } from "next/headers";
import { z } from "zod";
import {
  accountsRequired,
  authenticate,
  issueSession,
  readSession,
  revokeSession,
} from "@/backend/auth";
import { checkOrigin, sessionCookieOptions } from "@/backend/session";
import { audit } from "@/backend/store";

const login = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(128),
});
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const jar = await cookies();
  const current = await readSession(jar.get("unidata_session")?.value);
  return Response.json(
    {
      accountsRequired: accountsRequired(),
      authenticated: current?.mode === "account",
      identity: current
        ? {
            mode: current.mode,
            displayName: current.displayName,
            role: current.role,
          }
        : null,
    },
    { headers },
  );
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.text();
    if (body.length > 2048)
      return Response.json(
        { error: "Sign-in request is too large." },
        { status: 413, headers },
      );
    const parsed = login.safeParse(JSON.parse(body));
    if (!parsed.success)
      return Response.json(
        { error: "Enter a valid email and password." },
        { status: 400, headers },
      );
    const result = await authenticate(parsed.data.email, parsed.data.password);
    if (!result.ok)
      return Response.json(
        {
          error: result.locked
            ? "Too many attempts. Try again in 15 minutes."
            : "Email or password is incorrect.",
        },
        { status: result.locked ? 429 : 401, headers },
      );
    const jar = await cookies();
    const issued = await issueSession(result.role, result.userId);
    await revokeSession(jar.get("unidata_session")?.value);
    jar.set("unidata_session", issued.token, {
      ...sessionCookieOptions,
      maxAge: issued.maxAge,
    });
    const identity = (await readSession(issued.token))!;
    await audit(
      identity.role,
      "SIGN_IN",
      "Account session",
      "Signed in with a verified account.",
      "ALLOWED",
      identity,
    );
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      {
        error:
          "Sign-in could not be completed. Check your details and try again.",
      },
      { status: 400, headers },
    );
  }
}
export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get("unidata_session")?.value;
    const current = await readSession(token);
    await revokeSession(token);
    jar.delete("unidata_session");
    if (current?.mode === "account")
      await audit(
        current.role,
        "SIGN_OUT",
        "Account session",
        "Session revoked on sign-out.",
        "ALLOWED",
        current,
      );
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Sign-out could not be completed. Try again." },
      { status: 400, headers },
    );
  }
}
