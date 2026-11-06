import { session, AuthenticationRequired } from "@/lib/server/session";
import { audit, snapshot } from "@/lib/server/store";
import { makeReport } from "@/lib/server/reports";
import { unstable_rethrow } from "next/navigation";

function csv(value: string) {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export async function GET(request: Request) {
  try {
    const s = await session();
    const data = await snapshot(s.role, s);
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const studentId = url.searchParams.get("studentId");
    if (kind === "audit") {
      if (
        !["DEAN_REGISTRAR", "COMPLIANCE_AUDITOR", "ACADEMIC_ADVISOR"].includes(
          s.role,
        )
      )
        return Response.json(
          { error: "Audit access denied." },
          { status: 403 },
        );
      await audit(
        s.role,
        "EXPORT_DATA",
        "Audit trail",
        "Exported the audit trail available to this persona.",
        "ALLOWED",
        s,
      );
      const rows = (await snapshot(s.role, s)).auditLogs.map((l) =>
        [
          l.id,
          l.timestamp,
          l.userRole,
          l.actorName,
          l.action,
          l.targetResource,
          l.status,
          l.details,
          l.hash || "",
        ]
          .map(csv)
          .join(","),
      );
      return new Response(
        [
          "ID,Timestamp,Role,Actor,Action,Target,Status,Details,SHA256",
          ...rows,
        ].join("\r\n"),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="unidata-audit.csv"',
            "Cache-Control": "no-store",
          },
        },
      );
    }
    if (!["student", "analytics", "json"].includes(kind || ""))
      return Response.json({ error: "Unknown report." }, { status: 400 });
    const student = studentId
      ? data.masterRecords.find((r) => r.studentId === studentId)
      : undefined;
    if ((kind === "student" || kind === "json") && !student)
      return Response.json(
        { error: "Record unavailable to this persona." },
        { status: 404 },
      );
    await audit(
      s.role,
      "EXPORT_DATA",
      studentId || "Academic analytics",
      `Generated ${kind} report with server-applied permissions.`,
      "ALLOWED",
      s,
    );
    if (kind === "json")
      return new Response(JSON.stringify(student, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${student!.studentId}-360.json"`,
          "Cache-Control": "no-store",
        },
      });
    const bytes = await makeReport(
      data,
      kind === "student" ? student : undefined,
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${student?.studentId || "unidata-analytics"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired)
      return Response.json(
        { error: e.message },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    console.error(e);
    return Response.json(
      { error: "Report generation failed. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
