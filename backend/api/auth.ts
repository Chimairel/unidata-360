import { cookies } from "next/headers";
import { z } from "zod";
import {
  accountsRequired,
  authenticate,
  issueSession,
  readSession,
  revokeAndReadSession,
} from "@/backend/auth";
import { checkOrigin, sessionCookieOptions } from "@/backend/session";
import { audit, transaction } from "@/backend/store";

const loginSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").max(200),
    password: z.string().min(1, "Enter your password.").max(128),
  })
  .strict();

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const jar = await cookies();
  const current = await readSession(jar.get("karto_retail_session")?.value);
  return Response.json(
    {
      accountsRequired: accountsRequired(),
      authenticated: current?.mode === "account",
      identity: current
        ? {
            mode: current.mode,
            displayName: current.displayName,
            role: current.role,
            branch: current.branch,
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
    if (body.length > 2048) {
      return Response.json(
        { error: "Sign-in request is too large." },
        { status: 413, headers },
      );
    }
    const parsed = loginSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      return Response.json(
        { error: "Enter your work email and password." },
        { status: 400, headers },
      );
    }

    const result = await authenticate(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      if (result.userId && result.role) {
        const detail =
          result.reason === "locked"
            ? "Sign-in blocked due to account lockout."
            : result.reason === "disabled"
              ? "Sign-in blocked because the account is disabled."
              : "Sign-in rejected due to incorrect password.";
        await audit(
          result.role,
          "LOGIN_FAILED",
          "Retail session",
          detail,
          "RESTRICTED_MASKED",
          {
            mode: "account",
            userId: result.userId,
            displayName: result.displayName,
          },
        ).catch(() => {});
      }
      if (result.reason === "locked") {
        const mins = result.retryMinutes || 15;
        return Response.json(
          {
            error: `Too many failed sign-in attempts. Try again in ${mins} ${mins === 1 ? "minute" : "minutes"}.`,
          },
          { status: 429, headers },
        );
      }
      if (result.reason === "disabled") {
        return Response.json(
          { error: "This account has been disabled." },
          { status: 403, headers },
        );
      }
      if (result.reason === "not_found") {
        return Response.json(
          { error: "No retail account was found for that email." },
          { status: 401, headers },
        );
      }
      const left = result.remainingAttempts;
      return Response.json(
        {
          error:
            typeof left === "number" && left > 0
              ? `Incorrect password. ${left} ${left === 1 ? "attempt" : "attempts"} remaining before a 15-minute lockout.`
              : "Incorrect password.",
        },
        { status: 401, headers },
      );
    }

    const jar = await cookies();
    const oldSessionToken = jar.get("karto_retail_session")?.value;

    const issued = await transaction(async () => {
      const next = await issueSession(result.role, result.userId, {
        oldSessionToken,
        skipUserCheck: true,
      });
      await audit(
        result.role,
        "SIGN_IN",
        "Retail session",
        `Signed in as ${result.displayName}.`,
        "ALLOWED",
        {
          mode: "account",
          userId: result.userId,
          displayName: result.displayName,
          ...(result.branch ? { branch: result.branch } : {}),
        },
      );
      return next;
    });

    jar.set("karto_retail_session", issued.token, {
      ...sessionCookieOptions,
      maxAge: issued.maxAge,
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid sign-in request format." },
        { status: 400, headers },
      );
    }
    if (
      error instanceof Error &&
      error.message.includes("Cross-origin write requests")
    ) {
      return Response.json(
        { error: error.message },
        { status: 400, headers },
      );
    }
    console.error("Sign-in error:", error);
    return Response.json(
      {
        error:
          "Sign-in service could not reach the database. Check server logs and try again.",
      },
      { status: 503, headers },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get("karto_retail_session")?.value;
    if (token) {
      await transaction(async () => {
        const current = await revokeAndReadSession(token);
        if (current?.mode === "account") {
          await audit(
            current.role,
            "SIGN_OUT",
            "Retail session",
            "Session revoked on sign-out.",
            "ALLOWED",
            current,
          );
        }
      });
    }
    jar.delete("karto_retail_session");
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Sign-out could not be completed. Try again." },
      { status: 400, headers },
    );
  }
}
