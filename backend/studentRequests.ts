import type { SessionIdentity } from "./auth";
import type { Department } from "@/shared/school";
import type {
  RegistrationWorkspace,
  StudentAccessRequest,
} from "@/shared/registration";
import { rows } from "./store";
import { requireWorkflowRole } from "./workflow";

interface RequestRow {
  id: string;
  student_id: string;
  email: string;
  display_name: string;
  department: Department;
  created_at: string;
  email_verified_at: string;
  status: StudentAccessRequest["status"];
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
}
export async function registrationWorkspace(
  s: SessionIdentity,
): Promise<RegistrationWorkspace> {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const requests = await rows<RequestRow & { has_record: boolean }>(
    "SELECT r.id,r.student_id,r.email,r.display_name,r.department,r.created_at,r.email_verified_at,r.status,r.reviewed_at,r.reviewed_by,r.review_note,EXISTS(SELECT 1 FROM master m WHERE lower(m.id)=lower(r.student_id)) AS has_record FROM student_access_requests r ORDER BY r.created_at DESC",
  );
  return {
    requests: requests.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      email: r.email,
      fullName: r.display_name,
      department: r.department,
      createdAt: r.created_at,
      verifiedAt: r.email_verified_at,
      status: r.status,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      reviewNote: r.review_note,
      hasSchoolRecord: r.has_record,
    })),
  };
}
