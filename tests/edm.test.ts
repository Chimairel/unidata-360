import { after, test } from "node:test";
import assert from "node:assert/strict";
import { parseImport } from "../backend/validation";
import { runETLPipeline } from "../backend/etl/pipeline";
import {
  initialSISRecords,
  initialLMSRecords,
  initialLibraryRecords,
} from "../backend/data/mockData";
import {
  assignIntervention,
  audit,
  auditTrail,
  closeDatabase,
  execute,
  first,
  resetDemo,
  snapshot,
  source,
  transaction,
  upsert,
} from "../backend/store";
import type { SISRecord } from "../shared/types";
import {
  createAccount,
  authenticate,
  hashPassword,
  verifyPassword,
  issueSession,
  readSession,
  revokeSession,
  resetPassword,
} from "../backend/auth";

const testUrl = process.env.EDM_TEST_DATABASE_URL;
if (testUrl && testUrl === process.env.DATABASE_URL)
  throw new Error("Use a separate empty PostgreSQL database for tests.");
if (testUrl) process.env.DATABASE_URL = testUrl;
const databaseTest = testUrl ? test : test.skip;
after(closeDatabase);

test("ETL resolves foreign keys, deduplicates, and reports orphan records", () => {
  const orphan = { ...initialLMSRecords[0], studentId: "UNKNOWN" };
  const result = runETLPipeline(
    [...initialSISRecords, initialSISRecords[0]],
    [...initialLMSRecords, initialLMSRecords[0], orphan],
    initialLibraryRecords,
  );
  assert.equal(result.masterRecords.length, 8);
  assert.equal(result.report.anomaliesDetected, 3);
  assert.equal(result.report.status, "PARTIAL_SUCCESS");
  assert.equal(new Set(result.masterRecords.map((s) => s.studentId)).size, 8);
});
test("missing LMS is incomplete data, not evidence of zero attendance risk", () => {
  const { masterRecords } = runETLPipeline([initialSISRecords[0]], [], []);
  assert.equal(masterRecords[0].overallRiskCategory, "Safe");
  assert.equal(masterRecords[0].dataHealthScore, 70);
  assert.notEqual(masterRecords[0].librarySummary.clearanceStatus, "Cleared");
});
test("CSV handles commas and multiline quoted fields and converts numeric strings", () => {
  const row = {
    ...initialSISRecords[0],
    major: "Computing, Systems\nand Data",
  };
  const csv =
    Object.keys(row).join(",") +
    "\r\n" +
    Object.values(row)
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  const parsed = parseImport("SIS", csv, "csv") as SISRecord[];
  assert.equal(parsed[0].major, row.major);
  assert.equal(parsed[0].cumulativeGpa, 3.85);
});
test("invalid import batches reject ranges, missing fields, dates and unknown columns", () => {
  for (const row of [
    { ...initialSISRecords[0], cumulativeGpa: 5 },
    { ...initialSISRecords[0], dateOfBirth: "2004-02-30" },
    { studentId: "A" },
    { ...initialSISRecords[0], unexpected: "x" },
  ])
    assert.throws(
      () =>
        parseImport("SIS", JSON.stringify([initialSISRecords[0], row]), "json"),
      /Row 2/,
    );
  assert.throws(() => parseImport("SIS", "not json", "json"), /Invalid JSON/);
});
databaseTest(
  "PostgreSQL seeds once, upserts by feed key and rolls back partial transactions",
  async () => {
    assert.equal((await snapshot("DEAN_REGISTRAR")).masterRecords.length, 8);
    await transaction(() =>
      upsert("SIS", [
        initialSISRecords[0],
        { ...initialSISRecords[0], cumulativeGpa: 3.9 },
      ]),
    );
    assert.equal((await source<SISRecord>("SIS")).length, 8);
    assert.equal((await source<SISRecord>("SIS"))[0].cumulativeGpa, 3.9);
    await assert.rejects(() =>
      transaction(async () => {
        await upsert("SIS", [
          { ...initialSISRecords[0], studentId: "ROLLBACK" },
        ]);
        throw new Error("rollback");
      }),
    );
    assert.equal((await source<SISRecord>("SIS")).length, 8);
  },
);
databaseTest(
  "server projections withhold raw feeds and restrict student scope",
  async () => {
    const advisor = await snapshot("ACADEMIC_ADVISOR");
    assert.equal(advisor.sisRecords.length, 0);
    assert.ok(advisor.masterRecords[0].ssn.startsWith("•••"));
    assert.notEqual(
      advisor.masterRecords[0].financialAidStatus,
      initialSISRecords[0].financialAidStatus,
    );
    const student = await snapshot("STUDENT");
    assert.equal(student.masterRecords.length, 1);
    assert.equal(student.masterRecords[0].studentId, "STU-2024-001");
    assert.equal(student.auditLogs.length, 0);
    assert.equal(student.etlReports.length, 0);
    const auditor = await snapshot("COMPLIANCE_AUDITOR");
    assert.ok(auditor.masterRecords[0].fullName.startsWith("Student "));
    assert.equal(auditor.masterRecords[0].lmsSummary.courses.length, 0);
    assert.equal(auditor.masterRecords[0].dateOfBirth, "Restricted");
  },
);
databaseTest(
  "audit history is chained and PostgreSQL rejects mutation",
  async () => {
    await audit("DEAN_REGISTRAR", "ETL_SYNC_RUN", "Test", "Test event");
    assert.equal((await auditTrail()).valid, true);
    await assert.rejects(
      () => execute("UPDATE audit SET payload='{}'"),
      /append-only/,
    );
    await assert.rejects(() => execute("DELETE FROM audit"), /append-only/);
  },
);
databaseTest(
  "advisor follow-ups are idempotent and reset preserves audit and ETL history",
  async () => {
    await transaction(() =>
      assignIntervention("ACADEMIC_ADVISOR", "STU-2024-003"),
    );
    await transaction(() =>
      assignIntervention("ACADEMIC_ADVISOR", "STU-2024-003"),
    );
    assert.equal((await snapshot("DEAN_REGISTRAR")).interventions.length, 1);
    const before = await snapshot("DEAN_REGISTRAR");
    await transaction(() => resetDemo("DEAN_REGISTRAR"));
    const after = await snapshot("DEAN_REGISTRAR");
    assert.equal(after.interventions.length, 0);
    assert.equal(after.masterRecords.length, 8);
    assert.ok(after.auditLogs.length > before.auditLogs.length);
    assert.ok(after.etlReports.length > before.etlReports.length);
    assert.equal(after.auditIntegrity, true);
  },
);

test("password hashes are salted and verify without storing plaintext", async () => {
  const password = "Test-only-password-234!";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrect", first), false);
});
databaseTest(
  "account roles and student identity come from the server, with revocable hashed sessions",
  async () => {
    const password = "Test-account-password-234!";
    const account = await createAccount({
      email: "sophia@example.edu",
      displayName: "Sophia Test",
      password,
      role: "STUDENT",
      studentId: "STU-2024-002",
    });
    const login = await authenticate("SOPHIA@example.edu", password);
    assert.equal(login.ok, true);
    const issued = await issueSession("DEAN_REGISTRAR", account.id);
    const identity = (await readSession(issued.token))!;
    assert.equal(identity.role, "STUDENT");
    assert.equal(identity.mode, "account");
    assert.equal(identity.studentId, "STU-2024-002");
    assert.equal(
      await first("SELECT 1 FROM sessions WHERE id=?", issued.token),
      undefined,
    );
    const projection = await snapshot(identity.role, identity);
    assert.equal(projection.masterRecords.length, 1);
    assert.equal(projection.masterRecords[0].studentId, "STU-2024-002");
    await revokeSession(issued.token);
    assert.equal(await readSession(issued.token), null);
    await assert.rejects(() =>
      createAccount({
        email: "unlinked@example.edu",
        displayName: "Unlinked",
        password,
        role: "STUDENT",
      }),
    );
    await assert.rejects(
      () =>
        createAccount({
          email: "missing@example.edu",
          displayName: "Missing",
          password,
          role: "STUDENT",
          studentId: "MISSING",
        }),
      /Student ID/,
    );
  },
);
databaseTest(
  "accounts mode rejects demo sessions, expiration and disabled accounts",
  async () => {
    const account = await createAccount({
      email: "advisor@example.edu",
      displayName: "Advisor Test",
      password: "Test-only-password-234!",
      role: "ACADEMIC_ADVISOR",
    });
    const demo = await issueSession("DEAN_REGISTRAR");
    assert.equal((await readSession(demo.token))?.mode, "demo");
    process.env.EDM_AUTH_MODE = "accounts";
    try {
      assert.equal(await readSession(demo.token), null);
    } finally {
      delete process.env.EDM_AUTH_MODE;
    }
    const issued = await issueSession(account.role, account.id);
    assert.equal((await readSession(issued.token))?.mode, "account");
    await execute(
      "UPDATE sessions SET expires_at=0 WHERE user_id=?",
      account.id,
    );
    assert.equal(await readSession(issued.token), null);
    const another = await issueSession(account.role, account.id);
    await execute("UPDATE users SET active=0 WHERE id=?", account.id);
    assert.equal(await readSession(another.token), null);
  },
);
databaseTest(
  "failed login lockout is persistent; administrator password reset revokes all sessions",
  async () => {
    const email = "locked@example.edu";
    const password = "Test-only-password-234!";
    const account = await createAccount({
      email,
      displayName: "Lockout Test",
      password,
      role: "ACADEMIC_ADVISOR",
    });
    for (let n = 0; n < 5; n++)
      assert.equal((await authenticate(email, "wrong")).ok, false);
    assert.deepEqual(await authenticate(email, password), {
      ok: false,
      locked: true,
    });
    const before = await issueSession(account.role, account.id);
    await resetPassword(email, "Replacement-password-234!");
    assert.equal(await readSession(before.token), null);
    assert.equal((await authenticate(email, password)).ok, false);
    assert.equal(
      (await authenticate(email, "Replacement-password-234!")).ok,
      true,
    );
  },
);
databaseTest(
  "account audit attribution isolates two advisors with the same role",
  async () => {
    const first = {
      mode: "account" as const,
      userId: "advisor-1",
      displayName: "First Advisor",
    };
    const second = {
      mode: "account" as const,
      userId: "advisor-2",
      displayName: "Second Advisor",
    };
    await audit(
      "ACADEMIC_ADVISOR",
      "READ_STUDENT_360",
      "STU-2024-001",
      "First advisor read",
      "ALLOWED",
      first,
    );
    await audit(
      "ACADEMIC_ADVISOR",
      "READ_STUDENT_360",
      "STU-2024-001",
      "Second advisor read",
      "ALLOWED",
      second,
    );
    const logs = (await snapshot("ACADEMIC_ADVISOR", first)).auditLogs;
    assert.equal(logs.length, 1);
    assert.equal(logs[0].actorName, "First Advisor");
    assert.equal(logs[0].actorId, "advisor-1");
    assert.equal((await auditTrail()).valid, true);
  },
);
