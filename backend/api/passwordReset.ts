import { cookies } from "next/headers";
import { z } from "zod";
import { readSession } from "@/backend/auth";
import { checkOrigin } from "@/backend/session";
import { EmailUnavailable } from "@/backend/email";
import { RegistrationError } from "@/backend/registration";
import {
  requestStudentPasswordReset,
  resetStudentPassword,
} from "@/backend/passwordRecovery";

const headers = { "Cache-Control": "no-store" };
async function currentAccountSession() {
  try {
    const jar = await cookies();
    const current = await readSession(jar.get("unidata_session")?.value);
    return current?.mode === "account" ? current : null;
  } catch {
    return null;
  }
}
async function handle(request: Request, verify: boolean) {
  try {
    checkOrigin(request);
    if (!verify) {
      const signedIn = await currentAccountSession();
      if (signedIn) {
        return Response.json(
          {
            error: `You are already signed in as ${signedIn.displayName || signedIn.role}. Sign out first before requesting a password reset.`,
          },
          { status: 409, headers },
        );
      }
    }
    const body = await request.text();
    if (body.length > 2048)
      return Response.json(
        { error: "Password reset request is too large." },
        { status: 413, headers },
      );
    const input: unknown = JSON.parse(body);
    return Response.json(
      await (verify
        ? resetStudentPassword(input)
        : requestStudentPasswordReset(input)),
      { headers },
    );
  } catch (error) {
    if (error instanceof RegistrationError || error instanceof EmailUnavailable)
      return Response.json(
        { error: error.message },
        {
          status: error instanceof RegistrationError ? error.status : 503,
          headers,
        },
      );
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return Response.json(
        {
          error:
            issue?.path[0] === "password" && issue.message
              ? issue.message
              : "Check your school ID and email. New passwords must be 12–128 characters with at least 3 character types.",
        },
        { status: 400, headers },
      );
    }
    if (
      error instanceof SyntaxError ||
      (error instanceof Error &&
        error.message.includes("Cross-origin write requests"))
    ) {
      return Response.json(
        { error: "Password reset could not be completed. Try again." },
        { status: 400, headers },
      );
    }
    console.error("Password reset request error:", error);
    return Response.json(
      {
        error:
          "Password reset service could not reach the database. Try again shortly.",
      },
      { status: 503, headers },
    );
  }
}
export const POST = (request: Request) => handle(request, false);
export const verify = (request: Request) => handle(request, true);
