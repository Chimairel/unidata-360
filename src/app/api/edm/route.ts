import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import {
  session,
  checkOrigin,
  AuthenticationRequired,
} from "@/lib/server/session";
import {
  actors,
  assignIntervention,
  audit,
  execute,
  masters,
  resetDemo,
  snapshot,
  sync,
  transaction,
  upsert,
} from "@/lib/server/store";
import { parseImport } from "@/lib/server/validation";
import type { UserRole } from "@/lib/types";

const command = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("role"),
    role: z.enum([
      "DEAN_REGISTRAR",
      "ACADEMIC_ADVISOR",
      "STUDENT",
      "COMPLIANCE_AUDITOR",
    ]),
  }),
  z.object({ type: z.literal("sync") }),
  z.object({ type: z.literal("reset") }),
  z.object({
    type: z.literal("import"),
    feed: z.enum(["SIS", "LMS", "LIBRARY"]),
    format: z.enum(["csv", "json"]),
    content: z.string().max(2_000_000),
  }),
  z.object({ type: z.literal("intervention"), studentId: z.string().max(60) }),
  z.object({ type: z.literal("view"), studentId: z.string().max(60) }),
]);
export async function GET() {
  try {
    const s = await session();
    return Response.json(await snapshot(s.role, s), {
      headers: { "Cache-Control": "no-store" },
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
      {
        error:
          "The database could not be reached. Check server logs and try again.",
      },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 2_100_000)
      return Response.json(
        { error: "File too large. Maximum size is 2 MB." },
        { status: 413 },
      );
    const raw = await request.text();
    if (raw.length > 2_100_000)
      return Response.json(
        { error: "File too large. Maximum size is 2 MB." },
        { status: 413 },
      );
    const parsed = command.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return Response.json(
        { error: "Invalid request. Check the selected feed and file format." },
        { status: 400 },
      );
    const cmd = parsed.data;
    const s = await session();
    let role: UserRole = s.role;
    let message = "Saved";
    if (
      (["sync", "reset", "import"].includes(cmd.type) &&
        role !== "DEAN_REGISTRAR") ||
      (cmd.type === "intervention" &&
        !["DEAN_REGISTRAR", "ACADEMIC_ADVISOR"].includes(role))
    ) {
      await audit(
        role,
        "MASKING_OVERRIDE_ATTEMPT",
        cmd.type,
        "Server denied a command outside this persona’s permissions.",
        "RESTRICTED_MASKED",
        s,
      );
      return Response.json(
        { error: "This action requires a permitted persona." },
        { status: 403 },
      );
    }
    if (cmd.type === "role") {
      if (s.mode === "account") {
        await audit(
          role,
          "MASKING_OVERRIDE_ATTEMPT",
          "Account role",
          "Denied role switching for an authenticated account.",
          "RESTRICTED_MASKED",
          s,
        );
        return Response.json(
          {
            error:
              "Your role is assigned to your account and cannot be changed here.",
          },
          { status: 403 },
        );
      }
      await transaction(async () => {
        await execute("UPDATE sessions SET role=? WHERE id=?", cmd.role, s.id);
        await audit(
          cmd.role,
          "MASKING_OVERRIDE_ATTEMPT",
          "Demo persona",
          `Switched demonstration perspective from ${actors[role]} to ${actors[cmd.role]}.`,
        );
      });
      role = cmd.role;
      message = "Persona updated. Server permissions applied.";
    } else if (cmd.type === "sync") {
      await transaction(async () => {
        const report = await sync();
        await audit(
          role,
          "ETL_SYNC_RUN",
          report.id,
          `Reconciled ${report.recordsLoaded} student records.`,
          "ALLOWED",
          s,
        );
      });
      message = "ETL complete. Master records updated.";
    } else if (cmd.type === "reset") {
      await transaction(() => resetDemo(role, s));
      message = "Demo restored. Audit history retained.";
    } else if (cmd.type === "import") {
      const rows = parseImport(cmd.feed, cmd.content, cmd.format);
      await transaction(async () => {
        const result = await upsert(cmd.feed, rows);
        message = `${result.inserted} inserted, ${result.updated} updated; ${result.duplicates} duplicate keys merged. Run ETL to update the master store.`;
        await audit(role, "IMPORT_DATA", cmd.feed, message, "ALLOWED", s);
      });
    } else if (cmd.type === "intervention") {
      await transaction(() => assignIntervention(role, cmd.studentId, s));
      message = "Advisor follow-up saved.";
    } else if (cmd.type === "view") {
      if (
        (role === "STUDENT" &&
          cmd.studentId !==
            (s.mode === "account" ? s.studentId : "STU-2024-001")) ||
        !(await masters(cmd.studentId)).length
      )
        return Response.json({ error: "Record unavailable." }, { status: 404 });
      await audit(
        role,
        "READ_STUDENT_360",
        cmd.studentId,
        "Opened a student dossier with server-applied field permissions.",
        "ALLOWED",
        s,
      );
    }
    return Response.json(
      { snapshot: await snapshot(role, s), message },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthenticationRequired)
      return Response.json(
        { error: e.message },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { error: e instanceof Error ? e.message : "Request failed. Try again." },
      { status: 400 },
    );
  }
}
