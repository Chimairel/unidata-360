import { caseWorkspace, manageCase } from "../cases";
import { workflowResponse, workflowBody } from "./workflow";
export async function GET() {
  return workflowResponse(caseWorkspace);
}
export async function POST(request: Request) {
  return workflowResponse(async (s) => {
    const message = await manageCase(s, await workflowBody(request));
    return { message, ...(await caseWorkspace(s)) };
  });
}
