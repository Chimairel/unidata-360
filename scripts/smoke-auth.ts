import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createAccount } from "../backend/auth";
import {
  audit,
  auditTrail,
  closeDatabase,
  execute,
  source,
  transaction,
  upsert,
} from "../backend/store";
import { initialSISRecords } from "../backend/data/mockData";

async function main() {
  const testUrl = process.env.EDM_TEST_DATABASE_URL;
  if (!testUrl || testUrl === process.env.DATABASE_URL)
    throw new Error(
      "Set EDM_TEST_DATABASE_URL to an isolated verification database.",
    );
  process.env.DATABASE_URL = testUrl;
  const hosted = process.argv.includes("--hosted");
  const publicOrigin = "https://unidata.example.test";
  // This test exclusively uses 3005 and an isolated database.
  const portCheck = createServer();
  await new Promise<void>((resolve, reject) => {
    portCheck.once("error", () =>
      reject(new Error("Stop the app on port 3005 before running test:auth.")),
    );
    portCheck.listen(3005, "127.0.0.1", () => portCheck.close(() => resolve()));
  });
  const password = randomBytes(24).toString("base64url");
  await createAccount({
    email: "advisor@example.edu",
    displayName: "Test Advisor",
    password,
    role: "ACADEMIC_ADVISOR",
  });
  const student = await createAccount({
    email: "sophia@example.edu",
    displayName: "Sophia Test",
    password,
    role: "STUDENT",
    studentId: "STU-2024-002",
  });
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      audit(
        "DEAN_REGISTRAR",
        "ETL_SYNC_RUN",
        "Verification",
        `Concurrent check ${index}`,
      ),
    ),
  );
  assert.equal((await auditTrail()).valid, true);
  for (const sql of [
    "UPDATE audit SET payload='{}'",
    "DELETE FROM audit",
    "TRUNCATE audit",
  ]) {
    await assert.rejects(() => execute(sql), /append-only/);
  }
  await assert.rejects(
    () =>
      transaction(async () => {
        await upsert("SIS", [
          { ...initialSISRecords[0], studentId: "ROLLBACK-CHECK" },
        ]);
        throw new Error("Rollback check");
      }),
    /Rollback check/,
  );
  assert.equal((await source("SIS")).length, initialSISRecords.length);
  await closeDatabase();
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", "3005"],
    {
      env: {
        ...process.env,
        EDM_AUTH_MODE: "accounts",
        EDM_SECURE_COOKIES: hosted ? "true" : "false",
        EDM_PUBLIC_ORIGIN: hosted ? publicOrigin : "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (d) => {
    output += d;
  });
  child.stderr.on("data", (d) => {
    output += d;
  });
  const base = "http://localhost:3005";
  let checks = 0;
  async function request(
    url: string,
    status: number,
    body?: object,
    cookie?: string,
    method?: string,
    origin: string | null = hosted ? publicOrigin : base,
  ) {
    const response = await fetch(base + url, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(origin === null ? {} : { Origin: origin }),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(
      response.status,
      status,
      `${url} expected ${status}, got ${response.status}`,
    );
    checks++;
    return response;
  }
  function cookie(response: Response) {
    const value = response.headers.get("set-cookie");
    assert.ok(value);
    assert.ok(value?.includes("HttpOnly"));
    assert.ok(value?.toLowerCase().includes("samesite=strict"));
    assert.equal(/;\s*secure\b/i.test(value), hosted);
    return value.split(";")[0];
  }
  try {
    let ready = false;
    for (let n = 0; n < 100; n++) {
      try {
        const response = await fetch(base + "/api/auth");
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, `Server not ready: ${output}`);
    if (hosted) {
      const health = await request(
        "/api/health",
        200,
        undefined,
        undefined,
        undefined,
        null,
      );
      assert.deepEqual(await health.json(), { status: "ok" });
      assert.equal(health.headers.get("cache-control"), "no-store");
      assert.equal(health.headers.get("x-content-type-options"), "nosniff");
      const loginAttempt = { email: "advisor@example.edu", password };
      await request("/api/auth", 400, loginAttempt, undefined, undefined, null);
      await request("/api/auth", 400, loginAttempt, undefined, undefined, base);
    }
    const mode = await (await request("/api/auth", 200)).json();
    assert.equal(mode.accountsRequired, true);
    assert.equal(mode.authenticated, false);
    await request("/api/edm", 401);
    await request("/api/reports?kind=analytics", 401);
    await request("/api/edm", 401, { type: "sync" });
    await request("/login", 200);
    await request("/api/auth", 401, {
      email: "advisor@example.edu",
      password: "incorrect",
    });
    const login = await request("/api/auth", 200, {
      email: "advisor@example.edu",
      password,
    });
    const advisorCookie = cookie(login);
    const advisor = await (
      await request("/api/edm", 200, undefined, advisorCookie)
    ).json();
    assert.equal(advisor.accessMode, "account");
    assert.equal(advisor.currentRole, "ACADEMIC_ADVISOR");
    assert.equal(advisor.actorName, "Test Advisor");
    assert.equal(advisor.sisRecords.length, 0);
    await request(
      "/api/edm",
      403,
      { type: "role", role: "DEAN_REGISTRAR" },
      advisorCookie,
    );
    await request("/api/edm", 403, { type: "sync" }, advisorCookie);
    const fresh = await (
      await request("/api/edm", 200, undefined, advisorCookie)
    ).json();
    assert.equal(fresh.currentRole, "ACADEMIC_ADVISOR");
    assert.ok(
      fresh.auditLogs.every(
        (l: { actorName: string }) => l.actorName === "Test Advisor",
      ),
    );
    const studentCookie = cookie(
      await request("/api/auth", 200, {
        email: "sophia@example.edu",
        password,
      }),
    );
    const own = await (
      await request("/api/edm", 200, undefined, studentCookie)
    ).json();
    assert.equal(own.masterRecords.length, 1);
    assert.equal(own.masterRecords[0].studentId, "STU-2024-002");
    assert.equal(own.auditLogs.length, 0);
    await request(
      "/api/edm",
      404,
      { type: "view", studentId: "STU-2024-001" },
      studentCookie,
    );
    await request(
      "/api/reports?kind=json&studentId=STU-2024-001",
      404,
      undefined,
      studentCookie,
    );
    const exported = await (
      await request(
        "/api/reports?kind=json&studentId=STU-2024-002",
        200,
        undefined,
        studentCookie,
      )
    ).json();
    assert.ok(exported.ssn.includes("•"));
    await request("/api/reports?kind=audit", 403, undefined, studentCookie);
    await request(
      "/api/auth",
      400,
      { email: "advisor@example.edu", password },
      undefined,
      undefined,
      "https://example.com",
    );
    await request("/api/auth", 200, undefined, advisorCookie, "DELETE");
    await request("/api/edm", 401, undefined, advisorCookie);
    await execute("UPDATE users SET active=0 WHERE id=?", student.id);
    await closeDatabase();
    await request("/api/edm", 401, undefined, studentCookie);
    for (let n = 0; n < 5; n++)
      await request("/api/auth", 401, {
        email: "locked@example.edu",
        password: "wrong",
      });
    await request("/api/auth", 429, {
      email: "locked@example.edu",
      password: "wrong",
    });
    console.log(
      `PASS: ${checks} account-mode API checks. Anonymous denial, assigned roles, linked student scope, exports, revocation, disablement and throttling verified.`,
    );
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
  }
}
main()
  .finally(closeDatabase)
  .catch((e) => {
    console.error(
      e instanceof Error ? e.message : "Authentication integration test failed",
    );
    process.exitCode = 1;
  });
