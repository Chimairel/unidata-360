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

export interface StudentAccountsWorkspace {
  pending: number;
  active: number;
  message?: string;
}
