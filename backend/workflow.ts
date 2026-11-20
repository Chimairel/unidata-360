import type { SessionIdentity } from "./auth";
import type { UserRole } from "@/shared/types";
import { first } from "./store";

export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
export function assertWorkflowRole(
  s: SessionIdentity,
  roles: readonly UserRole[],
) {
  if (s.mode !== "account" || !s.userId || !roles.includes(s.role))
    throw new WorkflowError(
      "Sign in with a permitted staff account to use this workspace.",
    );
}
export async function requireWorkflowRole(
  s: SessionIdentity,
  roles: readonly UserRole[],
) {
  assertWorkflowRole(s, roles);
  const user = await first<{
    role: string;
    active: number;
    department: string | null;
  }>("SELECT role,active,department FROM users WHERE id=?", s.userId!);
  if (
    !user?.active ||
    user.role !== s.role ||
    (s.role === "DEAN" && user.department !== s.department)
  )
    throw new WorkflowError("Your account access has changed. Sign in again.");
}
