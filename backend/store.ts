import { closeStorage, withStorage } from "./storage";
import { createHash, randomUUID } from "node:crypto";
import {
  initialSISRecords,
  initialLMSRecords,
  initialLibraryRecords,
} from "./data/mockData";
import { runETLPipeline } from "./etl/pipeline";
import { applyFERPAMasking } from "./governance/masking";
import type {
  AuditLogEntry,
  EDMSnapshot,
  Feed,
  Intervention,
  LibraryRecord,
  LMSRecord,
  SISRecord,
  UnifiedStudentRecord,
  UserRole,
  ETLRunReport,
  AccessIdentity,
} from "@/shared/types";

export const actors: Record<UserRole, string> = {
  DEAN_REGISTRAR: "Dr. Arthur Vance (University Registrar)",
  ACADEMIC_ADVISOR: "Dr. Evelyn Reed (Senior Academic Advisor)",
  STUDENT: "Marcus Vance (Enrolled Student #001)",
  COMPLIANCE_AUDITOR: "Elena Cruz (Compliance Auditor)",
};

type Value = string | number | null;
type Payload = { payload: string };
export const closeDatabase = closeStorage;
export function rows<T>(sql: string, ...args: Value[]) {
  return withStorage(seedDatabase, (db) => db.rows<T>(sql, args));
}
export async function first<T>(sql: string, ...args: Value[]) {
  return (await rows<T>(sql, ...args))[0];
}
export async function execute(sql: string, ...args: Value[]) {
  await rows(sql, ...args);
}
export function transaction<T>(fn: () => Promise<T>) {
  return withStorage(seedDatabase, fn, "write");
}
async function seedDatabase() {
  await seed();
  await sync();
  await audit(
    "DEAN_REGISTRAR",
    "ETL_SYNC_RUN",
    "Initial seed",
    "Synthetic university feeds initialized.",
  );
}
async function seed() {
  await upsert("SIS", initialSISRecords);
  await upsert("LMS", initialLMSRecords);
  await upsert("LIBRARY", initialLibraryRecords);
}
export async function upsert(
  feed: Feed,
  input: Array<SISRecord | LMSRecord | LibraryRecord>,
) {
  const existing = new Set(
    (
      await rows<{ record_key: string }>(
        "SELECT record_key FROM sources WHERE feed=?",
        feed,
      )
    ).map((r) => r.record_key),
  );
  const batch = new Map<string, string>();
  let inserted = 0,
    updated = 0,
    duplicates = 0;
  for (const row of input) {
    const key =
      feed === "LMS"
        ? row.studentId + ":" + (row as LMSRecord).courseCode
        : row.studentId;
    if (batch.has(key)) duplicates++;
    if (existing.has(key) || batch.has(key)) updated++;
    else inserted++;
    batch.set(key, JSON.stringify(row));
  }
  if (batch.size)
    await execute(
      "INSERT INTO sources(feed,record_key,payload) VALUES " +
        Array.from(batch, () => "(?,?,?)").join(",") +
        " ON CONFLICT(feed,record_key) DO UPDATE SET payload=excluded.payload",
      ...Array.from(batch).flatMap(([key, payload]) => [feed, key, payload]),
    );
  return { inserted, updated, duplicates };
}
export async function source<T>(feed: Feed): Promise<T[]> {
  return (
    await rows<Payload>(
      "SELECT payload FROM sources WHERE feed=? ORDER BY record_key",
      feed,
    )
  ).map((r) => JSON.parse(r.payload));
}
export async function masters(
  studentId?: string,
): Promise<UnifiedStudentRecord[]> {
  const records = studentId
    ? await rows<Payload>("SELECT payload FROM master WHERE id=?", studentId)
    : await rows<Payload>("SELECT payload FROM master ORDER BY id");
  return records.map((r) => JSON.parse(r.payload));
}
export async function sync() {
  const result = runETLPipeline(
    await source<SISRecord>("SIS"),
    await source<LMSRecord>("LMS"),
    await source<LibraryRecord>("LIBRARY"),
  );
  await execute("DELETE FROM master");
  for (let start = 0; start < result.masterRecords.length; start += 1000) {
    const batch = result.masterRecords.slice(start, start + 1000);
    await execute(
      "INSERT INTO master(id,payload) VALUES " +
        batch.map(() => "(?,?)").join(","),
      ...batch.flatMap((s) => [s.studentId, JSON.stringify(s)]),
    );
  }
  await execute(
    "INSERT INTO etl_runs(payload) VALUES(?)",
    JSON.stringify(result.report),
  );
  return result.report;
}
export async function audit(
  role: UserRole,
  action: AuditLogEntry["action"],
  target: string,
  details: string,
  status: AuditLogEntry["status"] = "ALLOWED",
  identity?: AccessIdentity,
) {
  await transaction(async () => {
    const entry: AuditLogEntry = {
      id: "AUD-" + randomUUID(),
      timestamp: new Date().toISOString(),
      userRole: role,
      actorName: identity?.displayName || actors[role],
      ...(identity?.userId ? { actorId: identity.userId } : {}),
      action,
      targetResource: target,
      details,
      status,
    };
    const previous =
      (
        await first<{ hash: string }>(
          "SELECT hash FROM audit ORDER BY seq DESC LIMIT 1",
        )
      )?.hash || "GENESIS";
    const payload = JSON.stringify(entry);
    await execute(
      "INSERT INTO audit(payload,previous_hash,hash) VALUES(?,?,?)",
      payload,
      previous,
      createHash("sha256")
        .update(previous + payload)
        .digest("hex"),
    );
  });
}
export async function auditTrail() {
  let previous = "GENESIS",
    valid = true;
  const chain = await rows<Payload & { previous_hash: string; hash: string }>(
    "SELECT payload,previous_hash,hash FROM audit ORDER BY seq",
  );
  const entries = chain.map((row) => {
    if (
      row.previous_hash !== previous ||
      createHash("sha256")
        .update(previous + row.payload)
        .digest("hex") !== row.hash
    )
      valid = false;
    previous = row.hash;
    return { ...JSON.parse(row.payload), hash: row.hash } as AuditLogEntry;
  });
  return { entries: entries.reverse(), valid };
}
export function snapshot(
  role: UserRole,
  identity?: AccessIdentity,
): Promise<EDMSnapshot> {
  return withStorage(
    seedDatabase,
    async () => {
      const studentId =
        identity?.mode === "account" ? identity.studentId : "STU-2024-001";
      const student = role === "STUDENT";
      const registrar = role === "DEAN_REGISTRAR";
      const permitted = (
        student && !studentId
          ? []
          : await masters(student ? studentId : undefined)
      ).map((s) => applyFERPAMasking(s, role));
      const trail = await auditTrail();
      const sourceCounts: Record<Feed, number> = { SIS: 0, LMS: 0, LIBRARY: 0 };
      const sisRecords = registrar ? await source<SISRecord>("SIS") : [];
      const lmsRecords = registrar ? await source<LMSRecord>("LMS") : [];
      const libraryRecords = registrar
        ? await source<LibraryRecord>("LIBRARY")
        : [];
      if (student && studentId) {
        const counts = await rows<{ feed: Feed; count: string | number }>(
          "SELECT feed, COUNT(*) AS count FROM sources WHERE (feed='LMS' AND substr(record_key,1,?)=?) OR (feed<>'LMS' AND record_key=?) GROUP BY feed",
          studentId.length + 1,
          studentId + ":",
          studentId,
        );
        for (const { feed, count } of counts)
          sourceCounts[feed] = Number(count);
      } else if (!student) {
        for (const { feed, count } of await rows<{
          feed: Feed;
          count: string | number;
        }>("SELECT feed,COUNT(*) AS count FROM sources GROUP BY feed"))
          sourceCounts[feed] = Number(count);
      }
      const interventions =
        role === "COMPLIANCE_AUDITOR" || (student && !studentId)
          ? []
          : (
              await (student
                ? rows<Payload>(
                    "SELECT payload FROM interventions WHERE student_id=?",
                    studentId!,
                  )
                : rows<Payload>("SELECT payload FROM interventions"))
            ).map((r) => JSON.parse(r.payload) as Intervention);
      return {
        accessMode: identity?.mode || "demo",
        currentRole: role,
        actorName: identity?.displayName || actors[role],
        masterRecords: permitted,
        sisRecords,
        lmsRecords,
        libraryRecords,
        etlReports: student
          ? []
          : (
              await rows<Payload>(
                "SELECT payload FROM etl_runs ORDER BY seq DESC LIMIT 30",
              )
            ).map((r) => JSON.parse(r.payload) as ETLRunReport),
        auditLogs: student
          ? []
          : trail.entries.filter(
              (e) =>
                role !== "ACADEMIC_ADVISOR" ||
                (identity?.mode === "account"
                  ? e.actorId === identity.userId
                  : e.userRole === role),
            ),
        interventions,
        sourceCounts,
        auditIntegrity: trail.valid,
      };
    },
    "read",
  );
}
export async function resetDemo(role: UserRole, identity?: AccessIdentity) {
  await execute("DELETE FROM sources");
  await execute("DELETE FROM interventions");
  await seed();
  await sync();
  await audit(
    role,
    "RESET_DEMO",
    "Demonstration dataset",
    "Restored synthetic feeds; previous ETL reports and audit history preserved.",
    "ALLOWED",
    identity,
  );
}
export async function assignIntervention(
  role: UserRole,
  studentId: string,
  identity?: AccessIdentity,
) {
  const [student] = await masters(studentId);
  if (!student) throw new Error("Student not found");
  const existing = await first<Payload>(
    "SELECT payload FROM interventions WHERE student_id=?",
    studentId,
  );
  if (
    existing &&
    (JSON.parse(existing.payload) as Intervention).status === "Open"
  )
    return;
  const entry: Intervention = {
    id: randomUUID(),
    studentId,
    advisorName: student.advisorName,
    createdAt: new Date().toISOString(),
    status: "Open",
  };
  await execute(
    "INSERT INTO interventions(student_id,payload) VALUES(?,?) ON CONFLICT(student_id) DO UPDATE SET payload=excluded.payload",
    studentId,
    JSON.stringify(entry),
  );
  await audit(
    role,
    "CREATE_INTERVENTION",
    studentId,
    "Created an internal advisor follow-up for " +
      student.advisorName +
      ". No external message sent.",
    "ALLOWED",
    identity,
  );
}
