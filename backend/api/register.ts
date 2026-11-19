import { z } from "zod";
import { checkOrigin } from "@/backend/session";
import { EmailUnavailable } from "@/backend/email";
import {
  RegistrationError,
  requestStudentActivation,
  verifyStudentActivation,
} from "@/backend/registration";

const headers = { "Cache-Control": "no-store" };
async function handle(request: Request, verify: boolean) {
  try {
    checkOrigin(request);
    const body = await request.text();
    if (body.length > 2048)
      return Response.json(
        { error: "Activation request is too large." },
        { status: 413, headers },
      );
    const input: unknown = JSON.parse(body);
    const result = verify
      ? await verifyStudentActivation(input)
      : await requestStudentActivation(input);
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
            ? "Check your school ID and enrollment email. Passwords must be 12–128 characters."
            : "Activation could not be completed. Try again.",
      },
      { status: 400, headers },
    );
  }
}
export const POST = (request: Request) => handle(request, false);
export const verify = (request: Request) => handle(request, true);
