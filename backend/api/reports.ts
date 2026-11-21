import { unstable_rethrow } from "next/navigation";
import { session, AuthenticationRequired } from "@/backend/session";
import { audit, snapshot } from "@/backend/store";
import { makeReport } from "@/backend/reports";
import { canViewAnalytics, isSpecialist } from "@/shared/access";

function csv(value: string) {
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const s = await session();
    if (isSpecialist(s.role)) {
      return Response.json(
        { error: "Report exports are unavailable to this role." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const customerId = url.searchParams.get("customerId");

    if (kind === "sales" && !canViewAnalytics(s.role)) {
      return Response.json(
        { error: "Sales analytics export denied for this role." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (kind === "audit") {
      await audit(
        s.role,
        "EXPORT_REPORT",
        "Audit trail",
        "Exported the hash-chained audit trail available to this role.",
        "ALLOWED",
        s,
      );
      const data = await snapshot(s.role, s);
      const rows = data.auditLogs.map((l) =>
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
            "Content-Disposition":
              'attachment; filename="karto-retail-audit.csv"',
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!["customer", "sales", "json"].includes(kind || "")) {
      return Response.json({ error: "Unknown report kind." }, { status: 400 });
    }

    const data = await snapshot(s.role, s);
    const customer = customerId
      ? data.customers.find(
          (c) => c.customerId.toUpperCase() === customerId.toUpperCase(),
        )
      : undefined;

    if ((kind === "customer" || kind === "json") && !customer) {
      return Response.json(
        { error: "Customer record unavailable to this role." },
        { status: 404 },
      );
    }

    await audit(
      s.role,
      "EXPORT_REPORT",
      customer ? customer.customerId : "Sales analytics",
      `Generated ${kind} export with server-applied PCI DSS & GDPR masking.`,
      "ALLOWED",
      s,
    );

    if (kind === "json") {
      return new Response(JSON.stringify(customer, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${customer!.customerId}-360.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdfBytes = await makeReport(data, customer);
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${customer ? `${customer.customerId}-360` : "karto-sales-report"}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired) {
      return Response.json(
        { error: e.message },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error(e);
    return Response.json(
      { error: "Report generation failed. Try again." },
      { status: 500 },
    );
  }
}
