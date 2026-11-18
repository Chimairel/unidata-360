import { qualityWorkspace, manageQuality } from "../quality";
import { workflowResponse, workflowBody } from "./workflow";
export async function GET() {
  return workflowResponse(qualityWorkspace);
}
export async function POST(request: Request) {
  return workflowResponse(async (s) => {
    const message = await manageQuality(s, await workflowBody(request));
    return { message, ...(await qualityWorkspace(s)) };
  });
}
