import {
  manageStudentAccounts,
  studentAccountsWorkspace,
} from "../studentAccounts";
import { workflowBody, workflowResponse } from "./workflow";

export const GET = () => workflowResponse(studentAccountsWorkspace);
export const POST = (request: Request) =>
  workflowResponse(async (s) =>
    manageStudentAccounts(s, await workflowBody(request)),
  );
