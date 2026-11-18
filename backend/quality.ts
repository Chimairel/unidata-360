import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { SessionIdentity } from "./auth";
import type {
  AccessIdentity,
  QualityIssue,
  QualityWorkspace,
  SourceMetadata,
  SISRecord,
  LMSRecord,
  LibraryRecord,
  ETLRunReport,
} from "@/shared/types";
import {
  audit,
  execute,
  first,
  rows,
  source,
  transaction,
  upsert,
  masters,
} from "./store";
import { findQualityIssues } from "./quality-rules";
import { parseImport } from "./validation";
import { WorkflowError, requireWorkflowRole } from "./workflow";

export async function reconcileQuality(at: string, identity?: AccessIdentity) {
  const findings = findQualityIssues(
    await source<SISRecord>("SIS"),
    await source<LMSRecord>("LMS"),
    await source<LibraryRecord>("LIBRARY"),
  );
  const existing = new Map(
    (await rows<{ payload: string }>("SELECT payload FROM quality_issues")).map(
      (r) => {
        const issue = JSON.parse(r.payload) as QualityIssue;
        return [issue.id, issue];
      },
    ),
  );
  const current = new Set(findings.map((f) => f.id));
  for (const finding of findings) {
    const old = existing.get(finding.id);
    const reopened = old?.status === "Resolved";
    const issue: QualityIssue = {
      ...old,
      ...finding,
      firstSeenAt: old?.firstSeenAt || at,
      lastSeenAt: at,
      status: !old || reopened ? "Open" : old.status,
      history: old?.history || [],
    };
    if (reopened) {
      delete issue.resolvedAt;
      issue.history.push({
        id: randomUUID(),
        at,
        actor: identity?.displayName || "ETL",
        text: "Reopened: the source check failed again.",
      });
    }
    await execute(
      "INSERT INTO quality_issues(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      issue.id,
      JSON.stringify(issue),
    );
  }
  for (const issue of existing.values())
    if (!current.has(issue.id) && issue.status !== "Resolved") {
      issue.status = "Resolved";
      issue.resolvedAt = at;
      issue.history.push({
        id: randomUUID(),
        at,
        actor: identity?.displayName || "ETL",
        text: "Resolved by a successful source recheck during ETL.",
      });
      await execute(
        "UPDATE quality_issues SET payload=? WHERE id=?",
        JSON.stringify(issue),
        issue.id,
      );
      await audit(
        "REGISTRAR",
        "QUALITY_ISSUE_RESOLVED",
        issue.id,
        `${issue.rule} passed for ${issue.sourceKey}.`,
        "ALLOWED",
        identity,
      );
    }
  await execute(
    "INSERT INTO quality_state(id,checked_at) VALUES('current',?) ON CONFLICT(id) DO UPDATE SET checked_at=excluded.checked_at",
    at,
  );
}
export async function qualityWorkspace(
  s: SessionIdentity,
): Promise<QualityWorkspace> {
  await requireWorkflowRole(s, ["REGISTRAR", "COMPLIANCE_AUDITOR"]);
  return transaction(async () => {
    const issues = (
      await rows<{ payload: string }>("SELECT payload FROM quality_issues")
    )
      .map((r) => JSON.parse(r.payload) as QualityIssue)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
    const metadata = (
      await rows<{
        feed: SourceMetadata["feed"];
        record_key: string;
        received_at: string | null;
        received_by: string;
        revision: number;
      }>("SELECT * FROM source_metadata ORDER BY feed,record_key")
    ).map((r) => ({
      feed: r.feed,
      key: r.record_key,
      receivedAt: r.received_at,
      receivedBy: r.received_by,
      revision: r.revision,
    }));
    const definitions = [
      {
        feed: "SIS" as const,
        name: "Student Information System",
        owner: "Registrar",
        key: "studentId",
      },
      {
        feed: "LMS" as const,
        name: "Learning Management System",
        owner: "Academic departments",
        key: "studentId + courseCode",
      },
      {
        feed: "LIBRARY" as const,
        name: "Library",
        owner: "Library services",
        key: "studentId",
      },
    ];
    const catalog = [];
    for (const definition of definitions) {
      const received = metadata.filter((m) => m.feed === definition.feed);
      const known = received
        .map((m) => m.receivedAt)
        .filter((v): v is string => !!v)
        .sort();
      catalog.push({
        ...definition,
        rows: Number(
          (await first<{ count: string }>(
            "SELECT COUNT(*) AS count FROM sources WHERE feed=?",
            definition.feed,
          ))!.count,
        ),
        lastReceivedAt: known.at(-1) || null,
        unknownProvenance: received.filter((m) => !m.receivedAt).length,
      });
    }
    return {
      issues,
      metadata,
      sources: catalog,
      checkedAt:
        (
          await first<{ checked_at: string }>(
            "SELECT checked_at FROM quality_state WHERE id='current'",
          )
        )?.checked_at || null,
      runs: (
        await rows<{ payload: string }>(
          "SELECT payload FROM etl_runs ORDER BY seq DESC LIMIT 30",
        )
      ).map((r) => JSON.parse(r.payload) as ETLRunReport),
      stewards: await rows<{ id: string; displayName: string }>(
        "SELECT id,display_name AS \"displayName\" FROM users WHERE active=1 AND role='REGISTRAR' ORDER BY display_name",
      ),
      students: (await masters()).map(({ studentId, fullName }) => ({
        studentId,
        fullName:
          s.role === "COMPLIANCE_AUDITOR" ? `Student ${studentId}` : fullName,
      })),
    };
  });
}
export const qualityCommand = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("update"),
      id: z.string().max(100),
      ownerId: z.string().max(100).nullable(),
      status: z.enum(["Open", "In progress"]),
      note: z.string().trim().max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal("relink"),
      id: z.string().max(100),
      studentId: z.string().regex(/^[A-Za-z0-9_-]{1,60}$/),
    })
    .strict(),
]);
export async function manageQuality(s: SessionIdentity, input: unknown) {
  await requireWorkflowRole(s, ["REGISTRAR"]);
  const cmd = qualityCommand.parse(input);
  return transaction(async () => {
    await requireWorkflowRole(s, ["REGISTRAR"]);
    const row = await first<{ payload: string }>(
      "SELECT payload FROM quality_issues WHERE id=?",
      cmd.id,
    );
    if (!row) throw new WorkflowError("Quality issue not found.", 404);
    const issue = JSON.parse(row.payload) as QualityIssue;
    if (issue.status === "Resolved")
      throw new WorkflowError(
        "This issue is already resolved. Run ETL to check current source data.",
        409,
      );
    if (cmd.type === "update") {
      const owner = cmd.ownerId
        ? await first<{ display_name: string }>(
            "SELECT display_name FROM users WHERE id=? AND active=1 AND role='REGISTRAR'",
            cmd.ownerId,
          )
        : null;
      if (cmd.ownerId && !owner)
        throw new WorkflowError(
          "Choose an active Registrar as the issue steward.",
          400,
        );
      issue.status = cmd.status;
      issue.ownerId = cmd.ownerId || undefined;
      issue.ownerName = owner?.display_name;
      issue.history.push({
        id: randomUUID(),
        at: new Date().toISOString(),
        actor: s.displayName || "Registrar",
        text: `${cmd.status}; steward: ${owner?.display_name || "Unassigned"}.${cmd.note ? ` ${cmd.note}` : ""}`,
      });
      await execute(
        "UPDATE quality_issues SET payload=? WHERE id=?",
        JSON.stringify(issue),
        issue.id,
      );
      await audit(
        s.role,
        "QUALITY_ISSUE_UPDATED",
        issue.id,
        `Updated quality issue responsibility and status for ${issue.sourceKey}.`,
        "ALLOWED",
        s,
      );
      return "Quality issue updated. Resolution is confirmed by ETL after the source check passes.";
    }
    if (!issue.rule.startsWith("ORPHAN_"))
      throw new WorkflowError(
        "Only unlinked source records can be relinked. Upload missing records instead.",
        400,
      );
    if (
      !(await first(
        "SELECT 1 FROM sources WHERE feed='SIS' AND record_key=?",
        cmd.studentId,
      ))
    )
      throw new WorkflowError("Choose an existing SIS student.", 400);
    const sourceRow = await first<{ payload: string }>(
      "SELECT payload FROM sources WHERE feed=? AND record_key=?",
      issue.feed,
      issue.sourceKey,
    );
    if (!sourceRow)
      throw new WorkflowError(
        "The staged source has changed. Run ETL to recheck this issue.",
        409,
      );
    const corrected = {
      ...JSON.parse(sourceRow.payload),
      studentId: cmd.studentId,
    };
    const key =
      issue.feed === "LMS"
        ? `${cmd.studentId}:${corrected.courseCode}`
        : cmd.studentId;
    if (
      await first(
        "SELECT 1 FROM sources WHERE feed=? AND record_key=?",
        issue.feed,
        key,
      )
    )
      throw new WorkflowError(
        "The destination key already exists. Review and upload a corrected source file to avoid overwriting it.",
        409,
      );
    const records = parseImport(
      issue.feed,
      JSON.stringify([corrected]),
      "json",
    );
    await execute(
      "DELETE FROM sources WHERE feed=? AND record_key=?",
      issue.feed,
      issue.sourceKey,
    );
    // Record the correction receipt and maintain revision order across keys.
    const old = await first<{
      received_at: string | null;
      received_by: string;
      revision: number;
    }>(
      "SELECT * FROM source_metadata WHERE feed=? AND record_key=?",
      issue.feed,
      issue.sourceKey,
    );
    await upsert(issue.feed, records, s);
    if (old)
      await execute(
        "UPDATE source_metadata SET revision=? WHERE feed=? AND record_key=?",
        old.revision + 1,
        issue.feed,
        key,
      );
    await execute(
      "DELETE FROM source_metadata WHERE feed=? AND record_key=?",
      issue.feed,
      issue.sourceKey,
    );
    issue.history.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: s.displayName || "Registrar",
      text: `Staged identity correction to ${cmd.studentId}. Awaiting ETL recheck.`,
    });
    await execute(
      "UPDATE quality_issues SET payload=? WHERE id=?",
      JSON.stringify(issue),
      issue.id,
    );
    await audit(
      s.role,
      "QUALITY_SOURCE_CORRECTED",
      issue.id,
      `Relinked staged ${issue.feed} key ${issue.sourceKey} to ${key}; master unchanged until ETL.`,
      "ALLOWED",
      s,
    );
    return "Source identity corrected in staging. Run ETL to publish and resolve the issue.";
  });
}
