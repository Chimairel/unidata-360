import { registrationWorkspace } from "../studentRequests";
import { workflowBody, workflowResponse } from "./workflow";
import { requireWorkflowRole, WorkflowError } from "../workflow";
export const GET = () => workflowResponse(registrationWorkspace);
export const POST = (request: Request) =>
  workflowResponse(async (s) => {
    await requireWorkflowRole(s, ["REGISTRAR"]);
    await workflowBody(request);
    throw new WorkflowError(
      "Provision student accounts from the SIS roster.",
      410,
    );
  });
