import { z } from "zod";
import { checkOrigin } from "@/backend/session";
import { EmailUnavailable } from "@/backend/email";
import { RegistrationError } from "@/backend/registration";
import {
  requestStudentPasswordReset,
  resetStudentPassword,
} from "@/backend/passwordRecovery";

const headers = { "Cache-Control": "no-store" };
async function handle(request: Request, verify: boolean) {
  try {
    checkOrigin(request);
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
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Check your school ID and email. New passwords must be 12–128 characters."
            : "Password reset could not be completed. Try again.",
      },
      { status: 400, headers },
    );
  }
}
export const POST = (request: Request) => handle(request, false);
export const verify = (request: Request) => handle(request, true);
