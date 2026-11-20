import type { Department } from "./school";
export interface StudentAccessRequest {
  id: string;
  studentId: string;
  email: string;
  fullName: string;
  department: Department;
  createdAt: string;
  verifiedAt: string;
  status: "Pending" | "Approved" | "Rejected";
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  hasSchoolRecord: boolean;
}
export interface RegistrationWorkspace {
  requests: StudentAccessRequest[];
  message?: string;
}

export interface StudentAccountSummary {
  id: string;
  studentId: string;
  displayName: string;
  email: string;
  department: Department | null;
  activationRequired: boolean;
  active: boolean;
}

export interface StudentAccountsWorkspace {
  pending: number;
  active: number;
  disabled: number;
  students: StudentAccountSummary[];
  message?: string;
}
