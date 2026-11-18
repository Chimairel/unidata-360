import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { startServices } from "./services.mjs";
import { createAccount } from "../backend/auth";
import { closeDatabase, sync, transaction, upsert } from "../backend/store";
import {
  initialSISRecords,
  initialLMSRecords,
  initialLibraryRecords,
} from "../backend/data/mockData";
import type {
  CaseWorkspace,
  QualityWorkspace,
} from "../shared/types";

async function main() {
  const database = process.env.EDM_TEST_DATABASE_URL;
  if (!database || database === process.env.DATABASE_URL)
    throw new Error(
      "Use an isolated empty EDM_TEST_DATABASE_URL for workflow verification.",
    );
  process.env.DATABASE_URL = database;
  for (const port of [3005, 3006]) {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", () =>
        reject(new Error(`Stop port ${port} before testing.`)),
      );
      server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
    });
  }
  const password = randomBytes(24).toString("base64url");
  const users = new Map<string, string>();
  await transaction(async () => {
    for (const [key, role, department] of [
      ["registrar", "REGISTRAR", undefined],
      ["advisor", "ACADEMIC_ADVISOR", undefined],
      ["peer", "ACADEMIC_ADVISOR", undefined],
      ["dean", "DEAN", "BEED"],
      ["wrongdean", "DEAN", "BSIT"],
      ["admin", "SYSTEM_ADMIN", undefined],
      ["auditor", "COMPLIANCE_AUDITOR", undefined],
      ["student", "STUDENT", undefined],
    ] as const) {
      const account = await createAccount({
        email: `${key}@workflow.example`,
        displayName: `Workflow ${key}`,
        role,
        password,
        ...(department ? { department } : {}),
        ...(role === "STUDENT" ? { studentId: "STU-2024-001" } : {}),
      });
      users.set(key, account.id);
    }
    await upsert("SIS", [
      { ...initialSISRecords[0], studentId: "WF-HTTP-001", department: "BEED" },
    ]);
    await upsert("LMS", [
      {
        ...initialLMSRecords[0],
        studentId: "ORPHAN-HTTP",
        courseCode: "WF-101",
      },
    ]);
    await upsert("LIBRARY", [
      { ...initialLibraryRecords[0], studentId: "ORPHAN-HTTP" },
    ]);
    await sync();
  });
  await closeDatabase();
  const services = startServices(
    "start",
    {
      ...process.env,
      EDM_AUTH_MODE: "accounts",
      EDM_SECURE_COOKIES: "false",
      EDM_PUBLIC_ORIGIN: "http://localhost:3005",
      BACKEND_URL: "http://localhost:3006",
    },
    true,
  );
  for (const child of services.children) {
    child.stdout!.on("data", () => {});
    child.stderr!.on("data", () => {});
  }
  const base = "http://localhost:3005";
  let checks = 0;
  async function request(
    path: string,
    status: number,
    cookie?: string,
    body?: object,
    origin = base,
  ) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(
      r.status,
      status,
      `${path}: expected ${status}, received ${r.status}`,
    );
    checks++;
    return r;
  }
  const post = async (
    path: string,
    cookie: string,
    body: object,
    status = 200,
  ) => await (await request(path, status, cookie, body)).json();
  try {
    let ready = false;
    for (let n = 0; n < 150; n++) {
      try {
        if ((await fetch(base + "/login")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready);
    for (const path of ["/api/cases", "/api/quality"]) await request(path, 401);
    const cookies = new Map<string, string>();
    for (const key of users.keys()) {
      const r = await request("/api/auth", 200, undefined, {
        identifier:
          key === "student" ? "STU-2024-001" : `${key}@workflow.example`,
        password,
      });
      cookies.set(key, r.headers.get("set-cookie")!.split(";")[0]);
    }
    for (const role of ["admin", "student", "auditor"]) {
      await request("/api/cases", 403, cookies.get(role));
      await request("/api/cases", 403, cookies.get(role), { type: "create" });
    }
    for (const role of ["admin", "student", "advisor", "dean"]) {
      await request("/api/quality", 403, cookies.get(role));
      await request("/api/quality", 403, cookies.get(role), { type: "update" });
    }
    await request("/api/quality", 200, cookies.get("auditor"));
    const reg = cookies.get("registrar")!;
    const advisor = cookies.get("advisor")!;
    const peer = cookies.get("peer")!;
    const dean = cookies.get("dean")!;
    const create = {
      type: "create",
      studentId: "WF-HTTP-001",
      assigneeId: users.get("advisor"),
      reason: "Review engagement and plan academic support",
      priority: "High",
      dueDate: "2026-12-01",
    };
    await post(
      "/api/cases",
      reg,
      { ...create, assigneeId: users.get("admin") },
      400,
    );
    await post(
      "/api/cases",
      reg,
      { ...create, assigneeId: users.get("wrongdean") },
      400,
    );
    await post(
      "/api/cases",
      advisor,
      { ...create, assigneeId: users.get("peer") },
      400,
    );
    await post("/api/cases", cookies.get("wrongdean")!, create, 404);
    const created = (await post("/api/cases", reg, create)) as CaseWorkspace;
    const c = created.cases.find((c) => c.studentId === "WF-HTTP-001")!;
    assert.ok(c && c.assigneeId === users.get("advisor"));
    await post("/api/cases", reg, create, 409);
    const update = {
      type: "update",
      id: c.id,
      status: "In progress",
      priority: "High",
      dueDate: "2026-12-01",
      note: "PRIVATE_WORKFLOW_NOTE: outreach and support plan recorded",
      outcome: "",
    };
    await post("/api/cases", peer, update, 404);
    await post("/api/cases", cookies.get("wrongdean")!, update, 404);
    await request("/api/cases", 400, reg, update, "https://foreign.example");
    await post("/api/cases", advisor, update);
    await post(
      "/api/cases",
      advisor,
      { ...update, status: "Resolved", outcome: "" },
      400,
    );
    const visible = (await (
      await request("/api/cases", 200, dean)
    ).json()) as CaseWorkspace;
    assert.ok(
      visible.cases
        .find((v) => v.id === c.id)
        ?.notes.some((n) => n.text.includes("PRIVATE_WORKFLOW_NOTE")),
    );
    for (const key of ["student", "auditor", "admin", "peer"]) {
      const value = await (
        await request("/api/edm", 200, cookies.get(key))
      ).text();
      assert.ok(!value.includes("PRIVATE_WORKFLOW_NOTE"));
    }
    const peerCases = (await (
      await request("/api/cases", 200, peer)
    ).json()) as CaseWorkspace;
    assert.ok(!peerCases.cases.some((v) => v.id === c.id));
    await post("/api/edm", advisor, {
      type: "intervention",
      studentId: "WF-HTTP-001",
    });
    const preserved = (await (
      await request("/api/cases", 200, advisor)
    ).json()) as CaseWorkspace;
    assert.equal(preserved.cases.find((v) => v.id === c.id)!.notes.length, 1);
    await post("/api/cases", advisor, {
      ...update,
      status: "Resolved",
      note: "Completed review",
      outcome: "Student contacted and a support plan agreed",
    });
    await post(
      "/api/cases",
      advisor,
      { ...update, status: "Open", note: "" },
      400,
    );
    await post("/api/cases", advisor, {
      ...update,
      status: "Open",
      note: "Student requested a further review",
    });
    await post("/api/cases", reg, {
      type: "assign",
      id: c.id,
      assigneeId: users.get("peer"),
    });
    await post("/api/cases", advisor, update, 404);
    assert.ok(
      (
        (await (await request("/api/cases", 200, peer)).json()) as CaseWorkspace
      ).cases.some((v) => v.id === c.id),
    );
    let q = (await (
      await request("/api/quality", 200, reg)
    ).json()) as QualityWorkspace;
    const orphan = q.issues.find(
      (i) => i.rule === "ORPHAN_LMS" && i.studentId === "ORPHAN-HTTP",
    )!;
    const library = q.issues.find(
      (i) => i.rule === "ORPHAN_LIBRARY" && i.studentId === "ORPHAN-HTTP",
    )!;
    assert.ok(orphan && library);
    const qualityUpdate = {
      type: "update",
      id: orphan.id,
      status: "In progress",
      ownerId: users.get("registrar"),
      note: "Identity confirmed with source owner",
    };
    await post("/api/quality", cookies.get("auditor")!, qualityUpdate, 403);
    await post(
      "/api/quality",
      reg,
      { ...qualityUpdate, ownerId: users.get("advisor") },
      400,
    );
    await post(
      "/api/quality",
      reg,
      { ...qualityUpdate, status: "Resolved" },
      400,
    );
    await post("/api/quality", reg, qualityUpdate);
    await request(
      "/api/quality",
      400,
      reg,
      qualityUpdate,
      "https://foreign.example",
    );
    await post(
      "/api/quality",
      reg,
      { type: "relink", id: library.id, studentId: "STU-2024-001" },
      409,
    );
    await post(
      "/api/quality",
      reg,
      { type: "relink", id: orphan.id, studentId: "UNKNOWN" },
      400,
    );
    await post("/api/quality", reg, {
      type: "relink",
      id: orphan.id,
      studentId: "WF-HTTP-001",
    });
    await post("/api/quality", reg, {
      type: "relink",
      id: library.id,
      studentId: "WF-HTTP-001",
    });
    const before = await (await request("/api/edm", 200, reg)).json();
    assert.equal(
      before.masterRecords.find(
        (v: { studentId: string }) => v.studentId === "WF-HTTP-001",
      ).dataHealthScore,
      33,
    );
    q = (await (
      await request("/api/quality", 200, reg)
    ).json()) as QualityWorkspace;
    assert.notEqual(
      q.issues.find((i) => i.id === orphan.id)!.status,
      "Resolved",
    );
    await post("/api/edm", reg, { type: "sync" });
    q = (await (
      await request("/api/quality", 200, reg)
    ).json()) as QualityWorkspace;
    for (const id of [orphan.id, library.id])
      assert.equal(q.issues.find((i) => i.id === id)!.status, "Resolved");
    assert.ok(
      q.metadata.some(
        (m) => m.key === "WF-HTTP-001:WF-101" && m.revision === 2,
      ),
    );
    const after = await (await request("/api/edm", 200, reg)).json();
    assert.equal(
      after.masterRecords.find(
        (v: { studentId: string }) => v.studentId === "WF-HTTP-001",
      ).dataHealthScore,
      100,
    );
    assert.equal(after.auditIntegrity, true);
    for (const action of [
      "CASE_CREATED",
      "CASE_UPDATED",
      "CASE_ASSIGNED",
      "QUALITY_ISSUE_UPDATED",
      "QUALITY_ISSUE_RESOLVED",
      "QUALITY_SOURCE_CORRECTED",
    ])
      assert.ok(
        after.auditLogs.some((l: { action: string }) => l.action === action),
      );
    const auditQuality = await (
      await request("/api/quality", 200, cookies.get("auditor"))
    ).text();
    assert.ok(!auditQuality.includes(initialSISRecords[0].ssn));
    assert.ok(!auditQuality.includes("PRIVATE_WORKFLOW_NOTE"));
    console.log(
      `PASS: ${checks} workflow HTTP checks. Six-role restrictions, assigned case notes/outcomes/reopening, department scope, staged correction, ETL resolution, provenance and audit integrity verified.`,
    );
  } finally {
    await services.stop();
  }
}
main()
  .finally(closeDatabase)
  .catch((e) => {
    console.error(
      e instanceof Error ? e.message : "Workflow verification failed",
    );
    process.exitCode = 1;
  });
