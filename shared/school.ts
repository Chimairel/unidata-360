export const DEPARTMENTS = ["BSIT", "BEED", "BSED", "BSHM"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_NAMES: Record<Department, string> = {
  BSIT: "Bachelor of Science in Information Technology",
  BEED: "Bachelor of Elementary Education",
  BSED: "Bachelor of Secondary Education",
  BSHM: "Bachelor of Science in Hospitality Management",
};

export function isDepartment(value: unknown): value is Department {
  return DEPARTMENTS.includes(value as Department);
}
