import { cookies } from "next/headers";
import { z } from "zod";
import {
  completeStudentOnboarding,
  issueSession,
  readOnboardingSession,
  revokeOnboardingSession,
  strongPasswordSchema,
} from "@/backend/auth";
import { checkOrigin, sessionCookieOptions } from "@/backend/session";
import { audit } from "@/backend/store";
import { isDepartment } from "@/shared/school";

const headers = { "Cache-Control": "no-store" };

const onboardingSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
    password: strongPasswordSchema,
  })
  .strict();

function maskHintEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "••••@••••";
  if (local.length <= 2) return `${local[0] || "*"}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(5, local.length - 2))}@${domain}`;
}

export async function GET() {
  const jar = await cookies();
  const pending = await readOnboardingSession(
    jar.get("estante_onboarding")?.value,
  );
  if (!pending) {
    return Response.json(
      {
        error:
          "Sign in with your School ID and default password (123456) to activate your account.",
      },
      { status: 401, headers },
    );
  }
  return Response.json(
    {
      student: {
        studentId: pending.studentId,
        displayName: pending.displayName,
        emailHint: maskHintEmail(pending.email),
        department: pending.department,
      },
    },
    { headers },
  );
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get("estante_onboarding")?.value;
    if (!token) {
      return Response.json(
        {
          error:
            "Your activation session expired. Sign in again with your School ID and default password (123456).",
        },
        { status: 401, headers },
      );
    }
    const raw = await request.text();
    if (raw.length > 2048) {
      return Response.json(
        { error: "Activation request is too large." },
        { status: 413, headers },
      );
    }
    const parsed = onboardingSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return Response.json(
        {
          error:
            issue?.message ||
            "Enter your enrollment email and a strong new password.",
        },
        { status: 400, headers },
      );
    }
    let issued!: { token: string; maxAge: number };
    await completeStudentOnboarding(
      token,
      parsed.data.email,
      parsed.data.password,
      async (activated) => {
        const identity = {
          mode: "account" as const,
          userId: activated.userId,
          displayName: activated.displayName,
          studentId: activated.studentId,
          ...(isDepartment(activated.department)
            ? { department: activated.department }
            : {}),
        };
        await audit(
          "STUDENT",
          "STUDENT_REGISTERED",
          activated.studentId,
          "Student completed mandatory first-login activation and replaced the default password.",
          "ALLOWED",
          identity,
        );
        issued = await issueSession("STUDENT", activated.userId, {
          skipUserCheck: true,
        });
        await audit(
          "STUDENT",
          "SIGN_IN",
          "Account session",
          "Signed in after completing mandatory student onboarding.",
          "ALLOWED",
          identity,
        );
      },
    );
    jar.delete("estante_onboarding");
    jar.set("unidata_session", issued.token, {
      ...sessionCookieOptions,
      maxAge: issued.maxAge,
    });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Invalid activation request." },
        { status: 400, headers },
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Activation could not be completed. Try again.";
    const status = message.includes("expired") ? 401 : 400;
    return Response.json({ error: message }, { status, headers });
  }
}

export async function DELETE(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    await revokeOnboardingSession(jar.get("estante_onboarding")?.value);
    jar.delete("estante_onboarding");
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json(
      { error: "Could not cancel activation. Try again." },
      { status: 400, headers },
    );
  }
}
