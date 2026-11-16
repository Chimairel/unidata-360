import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { startServices } from "./services.mjs";
import { createAccount } from "../backend/auth";
import { closeDatabase } from "../backend/store";
import { STAFF_ROLES } from "../shared/accounts";

async function main() {
  const database = process.env.EDM_TEST_DATABASE_URL;
  if (!database || database === process.env.DATABASE_URL)
    throw new Error("Use an isolated empty EDM_TEST_DATABASE_URL.");
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
  const admin = await createAccount({
    email: "admin@example.test",
    displayName: "Test System Admin",
    role: "SYSTEM_ADMIN",
    password,
  });
  const student = await createAccount({
    email: "student@example.test",
    displayName: "Test Student",
    role: "STUDENT",
    studentId: "STU-2024-001",
    password,
  });
  for (const role of STAFF_ROLES)
    await createAccount({
      email: `${role.toLowerCase()}@example.test`,
      displayName: role,
      role,
      password,
      ...(role === "DEAN" ? { department: "BSIT" } : {}),
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
  // Drain captured output without echoing request or environment data.
  for (const child of services.children) {
    child.stdout!.on("data", () => {});
    child.stderr!.on("data", () => {});
  }
  const base = "http://localhost:3005";
  let checks = 0;
  async function request(
    path: string,
    status: number,
    body?: object,
    cookie?: string,
    origin = base,
  ) {
    const response = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(
      response.status,
      status,
      `${path}: expected ${status}, received ${response.status}: ${response.status === status ? "" : await response.clone().text()}`,
    );
    checks++;
    return response;
  }
  async function login(identifier: string, pass = password) {
    const response = await request("/api/auth", 200, {
      identifier,
      password: pass,
    });
    return response.headers.get("set-cookie")!.split(";")[0];
  }
  try {
    let ready = false;
    for (let n = 0; n < 150; n++) {
      try {
        if ((await fetch(base + "/login")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Both production services must start");
    await request("/api/accounts", 401);
    await request("/api/accounts", 401, {
      type: "status",
      id: admin.id,
      active: false,
    });
    for (const role of STAFF_ROLES) {
      const cookie = await login(`${role.toLowerCase()}@example.test`);
      await request("/api/accounts", 403, undefined, cookie);
      await request(
        "/api/accounts",
        403,
        {
          type: "create",
          email: "forbidden@example.test",
          role: "SYSTEM_ADMIN",
          password,
          displayName: "Forbidden",
        },
        cookie,
      );
    }
    const studentCookie = await login("STU-2024-001");
    await request("/api/accounts", 403, undefined, studentCookie);
    await request(
      "/api/accounts",
      403,
      { type: "status", id: admin.id, active: false },
      studentCookie,
    );
    const adminCookie = await login("admin@example.test");
    const initial = await (
      await request("/api/accounts", 200, undefined, adminCookie)
    ).json();
    assert.equal(initial.accounts.length, 5);
    const serialized = JSON.stringify(initial);
    for (const secret of [
      "password_hash",
      "passwordHash",
      "student_id",
      "studentId",
      "student@example.test",
      password,
    ])
      assert.ok(!serialized.includes(secret));
    const data = await (
      await request("/api/edm", 200, undefined, adminCookie)
    ).json();
    assert.equal(data.currentRole, "SYSTEM_ADMIN");
    for (const field of [
      "sisRecords",
      "lmsRecords",
      "libraryRecords",
      "masterRecords",
      "etlReports",
      "interventions",
    ])
      assert.deepEqual(data[field], []);
    assert.deepEqual(data.sourceCounts, { SIS: 0, LMS: 0, LIBRARY: 0 });
    for (const type of ["sync", "reset", "view", "intervention"])
      await request(
        "/api/edm",
        403,
        {
          type,
          ...(["view", "intervention"].includes(type)
            ? { studentId: "STU-2024-001" }
            : {}),
        },
        adminCookie,
      );
    for (const kind of ["analytics", "audit", "json", "student"])
      await request(
        `/api/reports?kind=${kind}&studentId=STU-2024-001`,
        403,
        undefined,
        adminCookie,
      );
    const details = {
      type: "create",
      displayName: "New Staff",
      email: "new@example.test",
      password,
      role: "DEAN",
      department: "BEED",
    };
    for (const role of ["STUDENT", "SYSTEM_ADMIN"])
      await request("/api/accounts", 400, { ...details, role }, adminCookie);
    await request(
      "/api/accounts",
      400,
      { ...details, department: undefined },
      adminCookie,
    );
    await request(
      "/api/accounts",
      400,
      { ...details, department: "OTHER" },
      adminCookie,
    );
    await request(
      "/api/accounts",
      400,
      details,
      adminCookie,
      "https://other.example.test",
    );
    const created = await (
      await request("/api/accounts", 200, details, adminCookie)
    ).json();
    assert.ok(!JSON.stringify(created).includes(password));
    const target = created.accounts.find(
      (a: { email: string }) => a.email === details.email,
    );
    assert.equal(target.department, "BEED");
    await request("/api/accounts", 409, details, adminCookie);
    let cookie = await login(details.email);
    assert.equal(
      (await (await request("/api/edm", 200, undefined, cookie)).json())
        .departmentScope,
      "BEED",
    );
    await request(
      "/api/accounts",
      200,
      {
        type: "update",
        id: target.id,
        displayName: "Updated Dean",
        role: "DEAN",
        department: "BSHM",
      },
      adminCookie,
    );
    await request("/api/edm", 401, undefined, cookie);
    cookie = await login(details.email);
    assert.equal(
      (await (await request("/api/edm", 200, undefined, cookie)).json())
        .departmentScope,
      "BSHM",
    );
    await request(
      "/api/accounts",
      200,
      { type: "status", id: target.id, active: false },
      adminCookie,
    );
    await request("/api/edm", 401, undefined, cookie);
    await request("/api/auth", 401, { identifier: details.email, password });
    await request(
      "/api/accounts",
      200,
      { type: "status", id: target.id, active: true },
      adminCookie,
    );
    cookie = await login(details.email);
    const replacement = randomBytes(24).toString("base64url");
    await request(
      "/api/accounts",
      200,
      { type: "password", id: target.id, password: replacement },
      adminCookie,
    );
    await request("/api/edm", 401, undefined, cookie);
    await request("/api/auth", 401, { identifier: details.email, password });
    await login(details.email, replacement);
    for (const id of [admin.id, student.id]) {
      await request(
        "/api/accounts",
        403,
        { type: "status", id, active: false },
        adminCookie,
      );
      await request(
        "/api/accounts",
        403,
        { type: "password", id, password: replacement },
        adminCookie,
      );
      await request(
        "/api/accounts",
        403,
        { type: "update", id, displayName: "Forbidden", role: "REGISTRAR" },
        adminCookie,
      );
    }
    const latest = await (
      await request("/api/accounts", 200, undefined, adminCookie)
    ).json();
    assert.ok(
      latest.activity.every(
        (e: { actorName: string }) => e.actorName === "Test System Admin",
      ),
    );
    for (const action of [
      "ACCOUNT_CREATED",
      "ACCOUNT_UPDATED",
      "ACCOUNT_STATUS_CHANGED",
      "STAFF_PASSWORD_RESET",
    ])
      assert.ok(
        latest.activity.some((e: { action: string }) => e.action === action),
      );
    assert.equal(
      (await (await request("/api/edm", 200, undefined, adminCookie)).json())
        .auditIntegrity,
      true,
    );
    console.log(
      `PASS: ${checks} Admin API checks. All six roles, staff creation/edit/status/password reset, session revocation, protected accounts, academic-data denial and audit integrity verified.`,
    );
  } finally {
    await services.stop();
    await closeDatabase();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Admin verification failed.",
  );
  process.exitCode = 1;
});
