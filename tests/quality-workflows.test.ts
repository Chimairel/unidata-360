import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { findQualityIssues } from "../backend/quality-rules";
import { runETLPipeline } from "../backend/etl/pipeline";
import {
  initialSISRecords,
  initialLMSRecords,
  initialLibraryRecords,
} from "../backend/data/mockData";
import { caseCommand, caseWorkspace, manageCase } from "../backend/cases";
import {
  manageQuality,
  qualityCommand,
  qualityWorkspace,
} from "../backend/quality";
import { WorkflowError } from "../backend/workflow";
import { createAccount, type SessionIdentity } from "../backend/auth";
import {
  assignIntervention,
  auditTrail,
  closeDatabase,
  execute,
  masters,
  snapshot,
  source,
  sync,
  transaction,
  upsert,
} from "../backend/store";
import type { LMSRecord } from "../shared/types";
const testUrl = process.env.EDM_TEST_DATABASE_URL;
if (testUrl && testUrl === process.env.DATABASE_URL)
  throw new Error("Use an isolated verification database.");
if (testUrl) process.env.DATABASE_URL = testUrl;
const databaseTest = testUrl ? test : test.skip;
after(closeDatabase);

test("source coverage counts actual feeds and quality findings keep stable identities", () => {
  const sis = [initialSISRecords[0]];
  assert.equal(
    runETLPipeline(sis, [], []).masterRecords[0].dataHealthScore,
    33,
  );
  assert.equal(
    runETLPipeline(sis, [initialLMSRecords[0]], []).masterRecords[0]
      .dataHealthScore,
    67,
  );
  assert.equal(
    runETLPipeline(sis, [initialLMSRecords[0]], [initialLibraryRecords[0]])
      .masterRecords[0].dataHealthScore,
    100,
  );
  const missing = runETLPipeline(sis, [], []);
  assert.equal(missing.report.status, "PARTIAL_SUCCESS");
  assert.equal(missing.masterRecords[0].overallRiskCategory, "Safe");
  const orphan = { ...initialLMSRecords[0], studentId: "UNKNOWN" };
  const first = findQualityIssues(sis, [orphan], []);
  assert.deepEqual(findQualityIssues(sis, [orphan], []), first);
  assert.equal(first.length, 3);
  assert.ok(
    first.some(
      (i) => i.rule === "ORPHAN_LMS" && i.sourceKey.includes(orphan.courseCode),
    ),
  );
});
test("workflow contracts reject forged status, staff-note injection and impossible dates", () => {
  assert.equal(
    qualityCommand.safeParse({
      type: "update",
      id: "x",
      ownerId: null,
      status: "Resolved",
      note: "",
    }).success,
    false,
  );
  assert.equal(
    caseCommand.safeParse({
      type: "create",
      studentId: "x",
      assigneeId: "staff",
      reason: "Needs support",
      priority: "High",
      dueDate: "2026-02-30",
    }).success,
    false,
  );
  assert.equal(
    caseCommand.safeParse({
      type: "create",
      studentId: "x",
      assigneeId: "staff",
      reason: "Needs support",
      priority: "High",
      dueDate: null,
      role: "REGISTRAR",
    }).success,
    false,
  );
});
databaseTest(
  "advising cases enforce assignment, department boundaries, outcomes and private notes",
  async () => {
    const tag = randomUUID().slice(0, 8);
    const password = randomUUID() + randomUUID();
    async function identity(
      role: SessionIdentity["role"],
      suffix: string,
      department?: "BSIT" | "BEED",
    ) {
      const account = await createAccount({
        email: `wf-${tag}-${suffix}@example.test`,
        displayName: `Workflow ${suffix}`,
        role,
        password,
        ...(department ? { department } : {}),
      });
      return {
        id: "test",
        mode: "account",
        role,
        userId: account.id,
        displayName: `Workflow ${suffix}`,
        ...(department ? { department } : {}),
      } as SessionIdentity;
    }
    const registrar = await identity("REGISTRAR", "registrar");
    const advisor = await identity("ACADEMIC_ADVISOR", "advisor");
    const peer = await identity("ACADEMIC_ADVISOR", "peer");
    const dean = await identity("DEAN", "dean", "BEED");
    const wrongDean = await identity("DEAN", "other", "BSIT");
    const admin = await identity("SYSTEM_ADMIN", "admin");
    const studentId = `WF-${tag}`;
    await transaction(async () => {
      await upsert(
        "SIS",
        [{ ...initialSISRecords[0], studentId, department: "BEED" }],
        registrar,
      );
      await sync(registrar);
    });
    const denied = (status: number) => (e: unknown) =>
      e instanceof WorkflowError && e.status === status;
    await assert.rejects(() => caseWorkspace(admin), denied(403));
    await assert.rejects(
      () => caseWorkspace({ ...admin, role: "REGISTRAR" }),
      denied(403),
    );
    await manageCase(registrar, {
      type: "create",
      studentId,
      assigneeId: advisor.userId,
      reason: "Attendance review and student support",
      priority: "High",
      dueDate: "2026-12-01",
    });
    const c = (await caseWorkspace(advisor)).cases.find(
      (c) => c.studentId === studentId,
    )!;
    assert.ok(c?.assigneeId === advisor.userId);
    assert.ok(!(await caseWorkspace(peer)).cases.some((v) => v.id === c.id));
    await assert.rejects(
      () =>
        manageCase(wrongDean, {
          type: "assign",
          id: c.id,
          assigneeId: wrongDean.userId,
        }),
      denied(404),
    );
    const update = {
      type: "update",
      id: c.id,
      status: "In progress",
      priority: "High",
      dueDate: "2026-12-01",
      note: "PRIVATE_CASE_NOTE outreach recorded",
      outcome: "",
    };
    await assert.rejects(() => manageCase(peer, update), denied(404));
    await manageCase(advisor, update);
    await assert.rejects(
      () =>
        manageCase(advisor, {
          ...update,
          status: "Resolved",
          note: "",
          outcome: "",
        }),
      denied(400),
    );
    await transaction(() =>
      assignIntervention("REGISTRAR", studentId, registrar),
    );
    assert.equal(
      (await caseWorkspace(dean)).cases.find((v) => v.id === c.id)!.notes
        .length,
      1,
      "legacy command must not overwrite case notes",
    );
    for (const role of [
      "STUDENT",
      "COMPLIANCE_AUDITOR",
      "SYSTEM_ADMIN",
    ] as const) {
      const view = await snapshot(role, { mode: "account", studentId });
      assert.ok(!JSON.stringify(view).includes("PRIVATE_CASE_NOTE"));
      assert.equal(view.interventions.length, 0);
    }
    assert.ok(
      !JSON.stringify(
        (await snapshot("REGISTRAR", registrar)).interventions,
      ).includes("PRIVATE_CASE_NOTE"),
    );
    await manageCase(advisor, {
      ...update,
      status: "Resolved",
      note: "Support completed",
      outcome: "Student contacted and support plan agreed",
    });
    await assert.rejects(
      () => manageCase(advisor, { ...update, status: "Open", note: "" }),
      denied(400),
    );
    await manageCase(advisor, {
      ...update,
      status: "Open",
      note: "Student requested another review",
    });
    const reopened = (await caseWorkspace(advisor)).cases.find(
      (v) => v.id === c.id,
    )!;
    assert.equal(reopened.status, "Open");
    assert.equal(reopened.notes.length, 3);
    assert.ok(reopened.history.some((h) => h.text.includes("Outcome:")));
    await execute("UPDATE users SET active=0 WHERE id=?", peer.userId!);
    await assert.rejects(
      () =>
        manageCase(registrar, {
          type: "assign",
          id: c.id,
          assigneeId: peer.userId,
        }),
      denied(400),
    );
    assert.equal((await auditTrail()).valid, true);
  },
);
databaseTest(
  "quality work resolves only after source correction and ETL, with provenance and collision protection",
  async () => {
    const tag = randomUUID().slice(0, 8);
    const password = randomUUID() + randomUUID();
    const user = await createAccount({
      email: `quality-${tag}@example.test`,
      displayName: "Quality Registrar",
      role: "REGISTRAR",
      password,
    });
    const auditor = await createAccount({
      email: `quality-audit-${tag}@example.test`,
      displayName: "Quality Auditor",
      role: "COMPLIANCE_AUDITOR",
      password,
    });
    const s = {
      id: "test",
      mode: "account",
      userId: user.id,
      role: "REGISTRAR",
      displayName: "Quality Registrar",
    } as SessionIdentity;
    const a = {
      ...s,
      userId: auditor.id,
      role: "COMPLIANCE_AUDITOR",
    } as SessionIdentity;
    const studentId = `QUALITY-${tag}`;
    const orphanId = `ORPHAN-${tag}`;
    await transaction(async () => {
      await upsert("SIS", [{ ...initialSISRecords[0], studentId }], s);
      await upsert(
        "LMS",
        [{ ...initialLMSRecords[0], studentId: orphanId }],
        s,
      );
      await sync(s);
    });
    let view = await qualityWorkspace(s);
    const orphan = view.issues.find(
      (i) => i.studentId === orphanId && i.rule === "ORPHAN_LMS",
    )!;
    const missing = view.issues.find(
      (i) => i.studentId === studentId && i.rule === "MISSING_LMS",
    )!;
    assert.ok(orphan && missing);
    assert.ok(
      view.metadata.some(
        (m) => m.key === studentId && m.revision === 1 && m.receivedAt,
      ),
    );
    assert.ok(
      !JSON.stringify(await qualityWorkspace(a)).includes(
        initialSISRecords[0].ssn,
      ),
    );
    const denied = (status: number) => (e: unknown) =>
      e instanceof WorkflowError && e.status === status;
    await assert.rejects(
      () =>
        manageQuality(a, {
          type: "update",
          id: orphan.id,
          ownerId: null,
          status: "Open",
          note: "",
        }),
      denied(403),
    );
    await assert.rejects(
      () =>
        manageQuality(s, {
          type: "update",
          id: orphan.id,
          ownerId: auditor.id,
          status: "Open",
          note: "",
        }),
      denied(400),
    );
    await manageQuality(s, {
      type: "update",
      id: orphan.id,
      ownerId: user.id,
      status: "In progress",
      note: "Source identity confirmed with owner",
    });
    await assert.rejects(
      () =>
        manageQuality(s, {
          type: "relink",
          id: orphan.id,
          studentId: "STU-2024-001",
        }),
      denied(409),
    );
    await manageQuality(s, { type: "relink", id: orphan.id, studentId });
    assert.ok(
      !(await source<LMSRecord>("LMS")).some((l) => l.studentId === orphanId),
    );
    assert.equal(
      (await masters(studentId))[0].lmsSummary.enrolledCoursesCount,
      0,
      "staged correction must not publish early",
    );
    assert.notEqual(
      (await qualityWorkspace(s)).issues.find((i) => i.id === orphan.id)!
        .status,
      "Resolved",
    );
    await transaction(() => sync(s));
    view = await qualityWorkspace(s);
    assert.equal(
      view.issues.find((i) => i.id === orphan.id)!.status,
      "Resolved",
    );
    assert.equal(
      view.issues.find((i) => i.id === missing.id)!.status,
      "Resolved",
    );
    assert.equal((await masters(studentId))[0].dataHealthScore, 67);
    assert.ok(
      view.metadata.some(
        (m) => m.key.startsWith(`${studentId}:`) && m.revision === 2,
      ),
    );
    await transaction(async () => {
      await upsert("LIBRARY", [{ ...initialLibraryRecords[0], studentId }], s);
      await sync(s);
    });
    assert.equal((await masters(studentId))[0].dataHealthScore, 100);
    await transaction(async () => {
      await execute(
        "DELETE FROM sources WHERE feed='LIBRARY' AND record_key=?",
        studentId,
      );
      await sync(s);
    });
    const reopened = (await qualityWorkspace(s)).issues.find(
      (i) => i.studentId === studentId && i.rule === "MISSING_LIBRARY",
    )!;
    assert.equal(reopened.status, "Open");
    assert.ok(reopened.history.some((h) => h.text.includes("Reopened")));
    assert.equal((await auditTrail()).valid, true);
  },
);
