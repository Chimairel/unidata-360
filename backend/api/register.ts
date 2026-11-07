import { z } from "zod";
import { checkOrigin } from "@/backend/session";
import { EmailUnavailable } from "@/backend/email";
import {
  RegistrationError,
  requestStudentRegistration,
  verifyStudentRegistration,
} from "@/backend/registration";

const headers = { "Cache-Control": "no-store" };
async function handle(request: Request, verify: boolean) {
  try {
    checkOrigin(request);
    const body = await request.text();
    if (body.length > 2048)
      return Response.json(
        { error: "Registration request is too large." },
        { status: 413, headers },
      );
    const input: unknown = JSON.parse(body);
    const result = verify
      ? await verifyStudentRegistration(input)
      : await requestStudentRegistration(input);
    return Response.json(result, { headers });
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
            ? "Check your details. Passwords must be 12–128 characters; only students can self-register."
            : "Registration could not be completed. Check your details and try again.",
      },
      { status: 400, headers },
    );
  }
}
export const POST = (request: Request) => handle(request, false);
export const verify = (request: Request) => handle(request, true);
