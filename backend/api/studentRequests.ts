import {
  registrationWorkspace,
  reviewStudentRequest,
} from "../studentRequests";
import { workflowBody, workflowResponse } from "./workflow";
export const GET = () => workflowResponse(registrationWorkspace);
export const POST = (request: Request) =>
  workflowResponse(async (s) =>
    reviewStudentRequest(s, await workflowBody(request)),
  );
