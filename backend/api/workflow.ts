import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { session, checkOrigin, AuthenticationRequired } from "../session";
import type { SessionIdentity } from "../auth";
import { WorkflowError } from "../workflow";
const headers = { "Cache-Control": "no-store" };
export async function workflowResponse(
  fn: (s: SessionIdentity) => Promise<unknown>,
) {
  try {
    return Response.json(await fn(await session()), { headers });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired)
      return Response.json({ error: e.message }, { status: 401, headers });
    if (e instanceof WorkflowError)
      return Response.json({ error: e.message }, { status: e.status, headers });
    if (e instanceof z.ZodError)
      return Response.json(
        { error: e.issues[0]?.message || "Check the form details." },
        { status: 400, headers },
      );
    console.error("Workflow request failed.");
    return Response.json(
      {
        error:
          "The workspace could not complete this request. Reload and try again.",
      },
      { status: 500, headers },
    );
  }
}
export async function workflowBody(request: Request) {
  try {
    checkOrigin(request);
  } catch {
    throw new WorkflowError(
      "Cross-origin write requests are not allowed.",
      400,
    );
  }
  const text = await request.text();
  if (text.length > 12000)
    throw new WorkflowError("The request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new WorkflowError("Send valid JSON form data.", 400);
  }
}
