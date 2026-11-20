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
} from "./store";
import { findQualityIssues } from "./quality-rules";
import { parseImport } from "./validation";
import {
  assertWorkflowRole,
  WorkflowError,
  requireWorkflowRole,
} from "./workflow";

export async function reconcileQuality(
  at: string,
  identity?: AccessIdentity,
  preloaded?: {
    sis: SISRecord[];
    lms: LMSRecord[];
    library: LibraryRecord[];
  },
) {
  const findings = findQualityIssues(
    preloaded ? preloaded.sis : await source<SISRecord>("SIS"),
    preloaded ? preloaded.lms : await source<LMSRecord>("LMS"),
    preloaded ? preloaded.library : await source<LibraryRecord>("LIBRARY"),
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
  const upserts: QualityIssue[] = [];
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
    upserts.push(issue);
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
      upserts.push(issue);
      await audit(
        "REGISTRAR",
        "QUALITY_ISSUE_RESOLVED",
        issue.id,
        `${issue.rule} passed for ${issue.sourceKey}.`,
        "ALLOWED",
        identity,
      );
    }
  for (let start = 0; start < upserts.length; start += 500) {
    const batch = upserts.slice(start, start + 500);
    await execute(
      "INSERT INTO quality_issues(id,payload) VALUES " +
        batch.map(() => "(?,?)").join(",") +
        " ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      ...batch.flatMap((issue) => [issue.id, JSON.stringify(issue)]),
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
  const row = await first<{
    issues: Array<{ payload: string }>;
    metadata: Array<{
      feed: SourceMetadata["feed"];
      record_key: string;
      received_at: string | null;
      received_by: string;
      revision: number;
    }>;
    counts: Array<{ feed: SourceMetadata["feed"]; count: number }>;
    checked_at: string | null;
    runs: Array<{ payload: string }>;
    stewards: Array<{ id: string; displayName: string }>;
    students: Array<{ payload: string }>;
  }>(
    `SELECT
       COALESCE((SELECT json_agg(json_build_object('payload', payload)) FROM quality_issues), '[]'::json) AS issues,
       COALESCE((SELECT json_agg(m ORDER BY feed, record_key) FROM source_metadata m), '[]'::json) AS metadata,
       COALESCE((SELECT json_agg(t) FROM (SELECT feed, COUNT(*)::int AS count FROM sources GROUP BY feed) t), '[]'::json) AS counts,
       (SELECT checked_at FROM quality_state WHERE id='current') AS checked_at,
       COALESCE((SELECT json_agg(json_build_object('payload', payload) ORDER BY seq DESC) FROM (SELECT seq, payload FROM etl_runs ORDER BY seq DESC LIMIT 30) e), '[]'::json) AS runs,
       COALESCE((SELECT json_agg(json_build_object('id', id, 'displayName', display_name) ORDER BY display_name) FROM users WHERE active=1 AND role='REGISTRAR'), '[]'::json) AS stewards,
       COALESCE((SELECT json_agg(json_build_object('payload', payload) ORDER BY id) FROM master), '[]'::json) AS students`,
  );
  const issues = (row?.issues || [])
    .map((r) => JSON.parse(r.payload) as QualityIssue)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  const metadata = (row?.metadata || []).map((r) => ({
    feed: r.feed,
    key: r.record_key,
    receivedAt: r.received_at,
    receivedBy: r.received_by,
    revision: r.revision,
  }));
  const feedCounts = new Map<SourceMetadata["feed"], number>();
  for (const item of row?.counts || [])
    feedCounts.set(item.feed, Number(item.count));
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
    {
      feed: "HR" as const,
      name: "HR & Payroll",
      owner: "Human Resources",
      key: "facultyId",
    },
    {
      feed: "ALUMNI" as const,
      name: "Alumni CRM",
      owner: "Alumni relations",
      key: "studentId",
    },
  ];
  const catalog = definitions.map((definition) => {
    const received = metadata.filter((m) => m.feed === definition.feed);
    const known = received
      .map((m) => m.receivedAt)
      .filter((v): v is string => !!v)
      .sort();
    return {
      ...definition,
      rows: feedCounts.get(definition.feed) || 0,
      lastReceivedAt: known.at(-1) || null,
      unknownProvenance: received.filter((m) => !m.receivedAt).length,
    };
  });
  return {
    issues,
    metadata,
    sources: catalog,
    checkedAt: row?.checked_at || null,
    runs: (row?.runs || []).map((r) => JSON.parse(r.payload) as ETLRunReport),
    stewards: row?.stewards || [],
    students: (row?.students || []).map((r) => {
      const { studentId, fullName } = JSON.parse(r.payload) as {
        studentId: string;
        fullName: string;
      };
      return {
        studentId,
        fullName:
          s.role === "COMPLIANCE_AUDITOR" ? `Student ${studentId}` : fullName,
      };
    }),
  };
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
  assertWorkflowRole(s, ["REGISTRAR"]);
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
