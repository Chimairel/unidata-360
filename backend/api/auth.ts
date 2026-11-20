import { cookies } from "next/headers";
import { z } from "zod";
import {
  accountsRequired,
  authenticate,
  issueOnboardingSession,
  issueSession,
  readOnboardingSession,
  readSession,
  revokeAndReadSession,
  revokeSession,
} from "@/backend/auth";
import { checkOrigin, sessionCookieOptions } from "@/backend/session";
import { audit, transaction } from "@/backend/store";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) =>
      z.email().safeParse(value).success || /^[A-Za-z0-9_-]{1,60}$/.test(value),
  );
export const loginSchema = z.union([
  z.object({ identifier, password: z.string().min(1).max(128) }).strict(),
  // Retain the previous request shape for staff integrations only.
  z
    .object({ email: z.email().max(200), password: z.string().min(1).max(128) })
    .strict()
    .transform(({ email, password }) => ({ identifier: email, password })),
]);
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const jar = await cookies();
  const current = await readSession(jar.get("unidata_session")?.value);
  const onboarding = !current
    ? await readOnboardingSession(jar.get("estante_onboarding")?.value)
    : null;
  return Response.json(
    {
      accountsRequired: accountsRequired(),
      authenticated: current?.mode === "account",
      onboardingRequired: Boolean(onboarding),
      onboardingStudent: onboarding
        ? {
            studentId: onboarding.studentId,
            displayName: onboarding.displayName,
            email: onboarding.email,
            department: onboarding.department,
          }
        : null,
      identity: current
        ? {
            mode: current.mode,
            displayName: current.displayName,
            role: current.role,
            department: current.department,
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
    const parsed = loginSchema.safeParse(JSON.parse(body));
    if (!parsed.success)
      return Response.json(
        { error: "Enter your school ID or staff email, and password." },
        { status: 400, headers },
      );
    const result = await authenticate(
      parsed.data.identifier,
      parsed.data.password,
    );
    if (!result.ok) {
      if (result.userId && result.role) {
        const detail =
          result.reason === "locked"
            ? "Sign-in blocked due to account lockout."
            : result.reason === "disabled"
              ? "Sign-in blocked because the account is disabled."
              : result.reason === "activation_required"
                ? "Sign-in blocked before student account activation."
                : result.reason === "student_used_email"
                  ? "Student attempted sign-in with email instead of school ID."
                  : "Sign-in rejected due to incorrect password.";
        await audit(
          result.role,
          "LOGIN_FAILED",
          "Account session",
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
      if (result.reason === "student_used_email") {
        return Response.json(
          {
            error:
              "Students must sign in with their School ID (for example, 20221010), not their email address.",
          },
          { status: 400, headers },
        );
      }
      if (result.reason === "disabled") {
        return Response.json(
          {
            error:
              "This account has been disabled. Contact your administrator or the Registrar.",
          },
          { status: 403, headers },
        );
      }
      if (result.reason === "activation_required") {
        return Response.json(
          {
            error:
              "This student account has not been activated yet. Use 'Activate student account' to set your first password.",
          },
          { status: 403, headers },
        );
      }
      if (result.reason === "not_found") {
        return Response.json(
          {
            error: "No account was found for that school ID or staff email.",
          },
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
    const oldSessionToken = jar.get("unidata_session")?.value;
    const oldOnboardingToken = jar.get("estante_onboarding")?.value;
    if (result.onboardingRequired) {
      const onboarding = await transaction(async () => {
        await revokeSession(oldSessionToken);
        return issueOnboardingSession(result.userId);
      });
      jar.delete("unidata_session");
      jar.set("estante_onboarding", onboarding.token, {
        ...sessionCookieOptions,
        maxAge: onboarding.maxAge,
      });
      return Response.json(
        {
          ok: true,
          onboardingRequired: true,
          student: {
            studentId: result.studentId,
            displayName: result.displayName,
            email: result.email,
          },
        },
        { headers },
      );
    }
    const issued = await transaction(async () => {
      const next = await issueSession(result.role, result.userId, {
        oldSessionToken,
        oldOnboardingToken,
        skipUserCheck: true,
      });
      await audit(
        result.role,
        "SIGN_IN",
        "Account session",
        "Signed in with a verified account.",
        "ALLOWED",
        {
          mode: "account",
          userId: result.userId,
          displayName: result.displayName,
          ...(result.studentId ? { studentId: result.studentId } : {}),
          ...(result.department ? { department: result.department } : {}),
        },
      );
      return next;
    });
    jar.delete("estante_onboarding");
    jar.set("unidata_session", issued.token, {
      ...sessionCookieOptions,
      maxAge: issued.maxAge,
    });
    return Response.json({ ok: true, onboardingRequired: false }, { headers });
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
    const token = jar.get("unidata_session")?.value;
    const onboardingToken = jar.get("estante_onboarding")?.value;
    if (token || onboardingToken) {
      await transaction(async () => {
        const current = await revokeAndReadSession(token, onboardingToken);
        if (current?.mode === "account")
          await audit(
            current.role,
            "SIGN_OUT",
            "Account session",
            "Session revoked on sign-out.",
            "ALLOWED",
            current,
          );
      });
    }
    jar.delete("unidata_session");
    jar.delete("estante_onboarding");
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Sign-out could not be completed. Try again." },
      { status: 400, headers },
    );
  }
}
