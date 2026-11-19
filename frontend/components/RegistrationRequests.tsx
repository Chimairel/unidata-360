"use client";

import { useWorkflowWorkspace } from "@/frontend/lib/useWorkflowWorkspace";
import type { RegistrationWorkspace } from "@/shared/registration";

export function RegistrationRequests() {
  const { data } = useWorkflowWorkspace<RegistrationWorkspace>(
    "/api/student-requests",
    true,
  );
  if (!data?.requests.length) return null;

  return (
    <details className="panel workflow-disclosure workflow-page">
      <summary>Previous registration requests</summary>
      <div className="panel-body table-wrap">
        <table className="workflow-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Department</th>
              <th>Email</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.requests.map((request) => (
              <tr key={request.id}>
                <td>
                  <strong>{request.fullName}</strong>
                  <span className="workflow-secondary">
                    {request.studentId}
                  </span>
                </td>
                <td>{request.department}</td>
                <td>{request.email}</td>
                <td>
                  {request.status === "Pending"
                    ? "Archived pending request"
                    : request.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
