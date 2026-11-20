import { closeStorage, withStorage } from "./storage";
import { createHash, randomUUID } from "node:crypto";
import {
  initialSISRecords,
  initialLMSRecords,
  initialLibraryRecords,
  initialHRRecords,
  initialAlumniRecords,
} from "./data/mockData";
import { runETLPipeline } from "./etl/pipeline";
import { applyFERPAMasking } from "./governance/masking";
import { isAdminAuditEntry } from "@/shared/accounts";
import {
  canAccessStudent,
  canFollowUp,
  departmentScope,
  ownAuditOnly,
} from "./access";
import type {
  AlumniRecord,
  AuditLogEntry,
  EDMSnapshot,
  Feed,
  HRRecord,
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
  SYSTEM_ADMIN: "CPC System Administrator",
  REGISTRAR: "Dr. Arthur Vance (University Registrar)",
  DEAN: "Dr. Maria Santos (BSIT Dean)",
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
export function readTransaction<T>(fn: () => Promise<T>) {
  return withStorage(seedDatabase, fn, "read");
}
async function seedDatabase() {
  await seed();
  await sync();
  await audit(
    "REGISTRAR",
    "ETL_SYNC_RUN",
    "Initial seed",
    "Synthetic university feeds initialized.",
  );
}
async function seed() {
  await upsert("SIS", initialSISRecords);
  await upsert("LMS", initialLMSRecords);
  await upsert("LIBRARY", initialLibraryRecords);
  await upsert("HR", initialHRRecords);
  await upsert("ALUMNI", initialAlumniRecords);
}
export async function upsert(
  feed: Feed,
  input: Array<SISRecord | LMSRecord | LibraryRecord | HRRecord | AlumniRecord>,
  identity?: AccessIdentity,
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
        ? (row as LMSRecord).studentId + ":" + (row as LMSRecord).courseCode
        : feed === "HR"
          ? (row as HRRecord).facultyId
          : (row as SISRecord | LibraryRecord | AlumniRecord).studentId;
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
  if (batch.size) {
    const receivedAt = new Date().toISOString();
    await execute(
      "INSERT INTO source_metadata(feed,record_key,received_at,received_by,revision) VALUES " +
        Array.from(batch, () => "(?,?,?,?,1)").join(",") +
        " ON CONFLICT(feed,record_key) DO UPDATE SET received_at=excluded.received_at,received_by=excluded.received_by,revision=source_metadata.revision+1",
      ...Array.from(batch.keys()).flatMap((key) => [
        feed,
        key,
        receivedAt,
        identity?.displayName || "Synthetic seed / local import",
      ]),
    );
  }
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
export async function sync(identity?: AccessIdentity) {
  const allSources = await rows<{ feed: Feed; payload: string }>(
    "SELECT feed, payload FROM sources ORDER BY feed, record_key",
  );
  const sis: SISRecord[] = [];
  const lms: LMSRecord[] = [];
  const library: LibraryRecord[] = [];
  const hr: HRRecord[] = [];
  const alumni: AlumniRecord[] = [];
  for (const row of allSources) {
    const parsed = JSON.parse(row.payload);
    if (row.feed === "SIS") sis.push(parsed);
    else if (row.feed === "LMS") lms.push(parsed);
    else if (row.feed === "LIBRARY") library.push(parsed);
    else if (row.feed === "HR") hr.push(parsed);
    else if (row.feed === "ALUMNI") alumni.push(parsed);
  }
  const result = runETLPipeline(sis, lms, library, undefined, hr, alumni);
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
  const { reconcileQuality } = await import("./quality");
  await reconcileQuality(result.report.endTime, identity, { sis, lms, library });
  return result.report;
}
export async function audit(
  role: UserRole,
  action: AuditLogEntry["action"],
  target: string,
  details: string,
  status: AuditLogEntry["status"] = "ALLOWED",
  identity?: AccessIdentity,
): Promise<AuditLogEntry> {
  return transaction(async () => {
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
    const hash = createHash("sha256")
      .update(previous + payload)
      .digest("hex");
    await execute(
      "INSERT INTO audit(payload,previous_hash,hash) VALUES(?,?,?)",
      payload,
      previous,
      hash,
    );
    return { ...entry, hash };
  });
}
export type AuditChainRow = {
  payload: string;
  previous_hash: string;
  hash: string;
};
export function verifyAuditRows(chain: AuditChainRow[]) {
  let previous = "GENESIS",
    valid = true;
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
export async function auditTrail() {
  const chain = await rows<AuditChainRow>(
    "SELECT payload,previous_hash,hash FROM audit ORDER BY seq",
  );
  return verifyAuditRows(chain);
}
export function snapshot(
  role: UserRole,
  identity?: AccessIdentity,
): Promise<EDMSnapshot> {
  return withStorage(seedDatabase, async () => {
    if (role === "SYSTEM_ADMIN") {
      const trail = await auditTrail();
      return {
        accessMode: identity?.mode || "demo",
        currentRole: role,
        actorName: identity?.displayName || actors[role],
        actorId: identity?.userId,
        sisRecords: [],
        lmsRecords: [],
        libraryRecords: [],
        hrRecords: [],
        alumniRecords: [],
        masterRecords: [],
        etlReports: [],
        interventions: [],
        sourceCounts: { SIS: 0, LMS: 0, LIBRARY: 0, HR: 0, ALUMNI: 0 },
        auditLogs: trail.entries.filter(isAdminAuditEntry),
        auditIntegrity: trail.valid,
      };
    }
    const studentId =
      identity?.mode === "account" ? identity.studentId : "20221010";
    const student = role === "STUDENT";
    const registrar = role === "REGISTRAR";
    if (student) {
      if (!studentId) {
        return {
          accessMode: identity?.mode || "demo",
          currentRole: role,
          actorName: identity?.displayName || actors[role],
          actorId: identity?.userId,
          masterRecords: [],
          sisRecords: [],
          lmsRecords: [],
          libraryRecords: [],
          hrRecords: [],
          alumniRecords: [],
          etlReports: [],
          auditLogs: [],
          interventions: [],
          sourceCounts: { SIS: 0, LMS: 0, LIBRARY: 0, HR: 0, ALUMNI: 0 },
          auditIntegrity: true,
        };
      }
      const row = await first<{
        master: Payload[];
        counts: Array<{ feed: Feed; count: number }>;
      }>(
        `SELECT
           COALESCE((SELECT json_agg(json_build_object('payload', payload)) FROM master WHERE id=?), '[]'::json) AS master,
           COALESCE((SELECT json_agg(t) FROM (
             SELECT feed, COUNT(*)::int AS count FROM sources
             WHERE (feed='LMS' AND substr(record_key,1,?)=?) OR (feed IN ('SIS','LIBRARY','ALUMNI') AND record_key=?)
             GROUP BY feed
           ) t), '[]'::json) AS counts`,
        studentId,
        studentId.length + 1,
        studentId + ":",
        studentId,
      );
      const permitted = (row?.master || [])
        .map((r) => JSON.parse(r.payload) as UnifiedStudentRecord)
        .filter((s) => canAccessStudent(role, identity, s))
        .map((s) => applyFERPAMasking(s, role));
      const sourceCounts: Record<Feed, number> = {
        SIS: 0,
        LMS: 0,
        LIBRARY: 0,
        HR: 0,
        ALUMNI: 0,
      };
      for (const { feed, count } of row?.counts || [])
        sourceCounts[feed] = Number(count);
      return {
        accessMode: identity?.mode || "demo",
        currentRole: role,
        actorName: identity?.displayName || actors[role],
        actorId: identity?.userId,
        departmentScope: departmentScope(role, identity),
        ...(identity?.mode === "account" && identity.studentId
          ? {
              studentProfile: {
                studentId: identity.studentId,
                fullName: identity.displayName || "Student",
                department: identity.department,
              },
            }
          : {}),
        masterRecords: permitted,
        sisRecords: [],
        lmsRecords: [],
        libraryRecords: [],
        hrRecords: [],
        alumniRecords: [],
        etlReports: [],
        auditLogs: [],
        interventions: [],
        sourceCounts,
        auditIntegrity: true,
      };
    }

    const args: Value[] = [];
    const cols: string[] = [
      "COALESCE((SELECT json_agg(json_build_object('payload', payload) ORDER BY id) FROM master), '[]'::json) AS master",
      "COALESCE((SELECT json_agg(json_build_object('payload', payload, 'previous_hash', previous_hash, 'hash', hash) ORDER BY seq) FROM audit), '[]'::json) AS audit",
    ];
    if (registrar) {
      cols.push(
        "COALESCE((SELECT json_agg(json_build_object('feed', feed, 'payload', payload) ORDER BY feed, record_key) FROM sources), '[]'::json) AS sources",
      );
    } else if (role === "DEAN") {
      const dept = departmentScope(role, identity) || "";
      args.push(dept, dept);
      cols.push(
        `COALESCE((SELECT json_agg(t) FROM (
          SELECT feed, COUNT(*)::int AS count FROM (
            SELECT s.feed FROM sources s JOIN master m ON m.id=split_part(s.record_key,':',1)
            WHERE s.feed IN ('SIS','LMS','LIBRARY') AND m.payload::jsonb->>'department'=?
            UNION ALL
            SELECT s.feed FROM sources s
            WHERE s.feed IN ('HR','ALUMNI') AND s.payload::jsonb->>'department'=?
          ) u GROUP BY feed
        ) t), '[]'::json) AS counts`,
      );
    } else {
      cols.push(
        "COALESCE((SELECT json_agg(t) FROM (SELECT feed, COUNT(*)::int AS count FROM sources GROUP BY feed) t), '[]'::json) AS counts",
      );
    }
    if (role !== "COMPLIANCE_AUDITOR") {
      cols.push(
        "COALESCE((SELECT json_agg(json_build_object('payload', payload)) FROM interventions), '[]'::json) AS interventions",
      );
    }
    if (registrar || role === "COMPLIANCE_AUDITOR") {
      cols.push(
        "COALESCE((SELECT json_agg(json_build_object('payload', payload) ORDER BY seq DESC) FROM (SELECT seq, payload FROM etl_runs ORDER BY seq DESC LIMIT 30) e), '[]'::json) AS etl",
      );
    }

    const row = await first<{
      master: Payload[];
      audit: AuditChainRow[];
      sources?: Array<{ feed: Feed; payload: string }>;
      counts?: Array<{ feed: Feed; count: number }>;
      interventions?: Payload[];
      etl?: Payload[];
    }>(`SELECT ${cols.join(", ")}`, ...args);

    const permitted = (row?.master || [])
      .map((r) => JSON.parse(r.payload) as UnifiedStudentRecord)
      .filter((s) => canAccessStudent(role, identity, s))
      .map((s) => applyFERPAMasking(s, role));
    const trail = verifyAuditRows(row?.audit || []);
    const sourceCounts: Record<Feed, number> = {
      SIS: 0,
      LMS: 0,
      LIBRARY: 0,
      HR: 0,
      ALUMNI: 0,
    };
    const sisRecords: SISRecord[] = [];
    const lmsRecords: LMSRecord[] = [];
    const libraryRecords: LibraryRecord[] = [];
    const hrRecords: HRRecord[] = [];
    const alumniRecords: AlumniRecord[] = [];
    if (registrar) {
      for (const s of row?.sources || []) {
        const parsed = JSON.parse(s.payload);
        sourceCounts[s.feed] += 1;
        if (s.feed === "SIS") sisRecords.push(parsed);
        else if (s.feed === "LMS") lmsRecords.push(parsed);
        else if (s.feed === "LIBRARY") libraryRecords.push(parsed);
        else if (s.feed === "HR") hrRecords.push(parsed);
        else if (s.feed === "ALUMNI") alumniRecords.push(parsed);
      }
    } else {
      for (const { feed, count } of row?.counts || [])
        sourceCounts[feed] = Number(count);
    }
    const interventions =
      role === "COMPLIANCE_AUDITOR"
        ? []
        : (row?.interventions || [])
            .map((r) => JSON.parse(r.payload) as Intervention)
            .filter(
              (entry) =>
                permitted.some((s) => s.studentId === entry.studentId) &&
                (role !== "ACADEMIC_ADVISOR" ||
                  identity?.mode !== "account" ||
                  !entry.assigneeId ||
                  entry.assigneeId === identity.userId ||
                  entry.createdById === identity.userId),
            )
            .map(
              ({
                id,
                studentId,
                advisorName,
                createdAt,
                status,
                assigneeId,
                createdById,
                reason,
                priority,
                dueDate,
                updatedAt,
                outcome,
              }) => ({
                id,
                studentId,
                advisorName,
                createdAt,
                status,
                assigneeId,
                createdById,
                reason,
                priority,
                dueDate,
                updatedAt,
                outcome,
              }),
            );
    return {
      accessMode: identity?.mode || "demo",
      currentRole: role,
      actorName: identity?.displayName || actors[role],
      actorId: identity?.userId,
      departmentScope: departmentScope(role, identity),
      masterRecords: permitted,
      sisRecords,
      lmsRecords,
      libraryRecords,
      hrRecords,
      alumniRecords,
      etlReports: (row?.etl || []).map(
        (r) => JSON.parse(r.payload) as ETLRunReport,
      ),
      auditLogs: trail.entries.filter(
        (e) =>
          !ownAuditOnly(role) ||
          (identity?.mode === "account"
            ? e.actorId === identity.userId
            : e.userRole === role),
      ),
      interventions,
      sourceCounts,
      auditIntegrity: trail.valid,
    };
  });
}
export async function resetDemo(role: UserRole, identity?: AccessIdentity) {
  await execute("DELETE FROM sources");
  await execute("DELETE FROM source_metadata");
  await execute("DELETE FROM interventions");
  await seed();
  await sync(identity);
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
  if (
    !canFollowUp(role) ||
    !student ||
    !canAccessStudent(role, identity, student)
  )
    throw new Error("Record unavailable to this account");
  const existing = await first<Payload>(
    "SELECT payload FROM interventions WHERE student_id=?",
    studentId,
  );
  if (existing) return;
  const entry: Intervention = {
    id: randomUUID(),
    studentId,
    advisorName: "Unassigned referral",
    createdById: identity?.userId,
    reason: "Academic support referral — assign a staff member in Cases",
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
export async function graduateStudent(
  role: UserRole,
  studentId: string,
  identity?: AccessIdentity,
) {
  if (role !== "REGISTRAR")
    throw new Error("Only the Registrar can record student graduation.");
  const row = await first<Payload>(
    "SELECT payload FROM sources WHERE feed='SIS' AND record_key=?",
    studentId,
  );
  if (!row) throw new Error("Student record not found in SIS.");
  const sis = JSON.parse(row.payload) as SISRecord;
  const updatedSis: SISRecord = {
    ...sis,
    enrollmentStatus: "Graduated",
    yearLevel: "Graduate",
  };
  await upsert("SIS", [updatedSis], identity);
  const alumni: AlumniRecord = {
    studentId: updatedSis.studentId,
    fullName: `${updatedSis.firstName} ${updatedSis.lastName}`,
    department: updatedSis.department,
    graduationYear: new Date().getFullYear(),
    degreeConferred: updatedSis.major,
    employmentStatus: "Seeking",
    employer: "Pending placement",
    contactConsent: "Opted In",
  };
  await upsert("ALUMNI", [alumni], identity);
  await sync(identity);
  await audit(
    role,
    "GRADUATE_STUDENT",
    updatedSis.studentId,
    `Marked ${updatedSis.firstName} ${updatedSis.lastName} as Graduated and handed off to Alumni CRM.`,
    "ALLOWED",
    identity,
  );
}
