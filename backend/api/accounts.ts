import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import {
  session,
  checkOrigin,
  AuthenticationRequired,
} from "@/backend/session";
import {
  AccountManagementError,
  isAccountAdministrator,
  listStaffAccounts,
  manageStaffAccount,
} from "@/backend/accounts";
import { snapshot } from "@/backend/store";
const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof AuthenticationRequired)
    return Response.json({ error: error.message }, { status: 401, headers });
  if (error instanceof AccountManagementError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      { error: error.issues[0]?.message || "Check the account details." },
      { status: 400, headers },
    );
  return Response.json(
    {
      error:
        "Account management could not be completed. Refresh and try again.",
    },
    { status: 400, headers },
  );
}
export async function GET() {
  try {
    const s = await session();
    const accounts = await listStaffAccounts(s);
    return Response.json(
      { accounts, activity: (await snapshot(s.role, s)).auditLogs },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const s = await session();
    if (!isAccountAdministrator(s))
      throw new AccountManagementError("System Admin access is required.");
    const body = await request.text();
    if (body.length > 4096)
      return Response.json(
        { error: "Account request is too large." },
        { status: 413, headers },
      );
    const message = await manageStaffAccount(s, JSON.parse(body));
    return Response.json(
      {
        message,
        accounts: await listStaffAccounts(s),
        activity: (await snapshot(s.role, s)).auditLogs,
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
