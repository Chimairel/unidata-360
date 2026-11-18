import type { AdvisingCase, Intervention } from "./types";
export function caseSummary(c: AdvisingCase): Intervention {
  const {
    id,
    studentId,
    advisorName,
    createdAt,
    status,
    assigneeId,
    createdById,
    reason,
    priority,
    dueDate,
    updatedAt,
    outcome,
  } = c;
  return {
    id,
    studentId,
    advisorName,
    createdAt,
    status,
    assigneeId,
    createdById,
    reason,
    priority,
    dueDate,
    updatedAt,
    outcome,
  };
}
