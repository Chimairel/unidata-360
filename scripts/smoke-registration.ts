import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { startServices } from "./services.mjs";
import { closeDatabase, first } from "../backend/store";
import { initialSISRecords } from "../backend/data/mockData";

async function main() {
  const database = process.env.EDM_TEST_DATABASE_URL;
  if (!database || database === process.env.DATABASE_URL)
    throw new Error("Use an isolated empty EDM_TEST_DATABASE_URL.");
  process.env.DATABASE_URL = database;
  for (const port of [3005, 3006]) {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", () =>
        reject(new Error(`Stop the app on port ${port} before testing.`)),
      );
      server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
    });
  }
  assert.equal(
    Number(
      (await first<{ count: string }>("SELECT COUNT(*) AS count FROM users"))!
        .count,
    ),
    0,
    "Use an empty verification database.",
  );
  const directory = await mkdtemp(
    path.join(tmpdir(), "unidata-registration-http-"),
  );
  const origin = "http://localhost:3005";
  const services = startServices(
    "start",
    {
      ...process.env,
      VERCEL: "",
      RAILWAY_PROJECT_ID: "",
      EDM_AUTH_MODE: "accounts",
      EDM_SECURE_COOKIES: "false",
      EDM_PUBLIC_ORIGIN: origin,
      EDM_EMAIL_MODE: "preview",
      EDM_EMAIL_PREVIEW_DIR: directory,
      BACKEND_URL: "http://localhost:3006",
    },
    true,
  );
  for (const child of services.children) {
    child.stdout!.resume();
    child.stderr!.resume();
  }
  let checks = 0;
  async function post(route: string, body: unknown, expected: number) {
    const response = await fetch(origin + route, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, expected, route);
    checks++;
    return response;
  }
  try {
    let ready = false;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        if ((await fetch(origin + "/api/auth")).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "Both production services must start");
    for (const route of ["/login", "/register"]) {
      const response = await fetch(origin + route);
      assert.equal(response.status, 200);
      assert.match(
        await response.text(),
        route === "/register"
          ? /Create your student account/
          : /Sign in to UniData/,
      );
      checks++;
    }
    const student = initialSISRecords[3];
    const password = randomBytes(24).toString("base64url");
    const details = { studentId: student.studentId, email: student.email };
    await post("/api/register", { ...details, role: "REGISTRAR" }, 400);
    const missing = await post(
      "/api/register",
      { studentId: "UNKNOWN", email: "unknown@example.edu" },
      200,
    );
    const sent = await post("/api/register", details, 200);
    assert.deepEqual(await sent.json(), await missing.json());
    assert.equal(sent.headers.get("cache-control"), "no-store");
    await post("/api/auth", { email: student.email, password }, 401);
    await post("/api/register", details, 429);
    const messages = await readdir(directory);
    assert.equal(messages.length, 1);
    const token = (
      await readFile(path.join(directory, messages[0]), "utf8")
    ).match(/#token=([a-f0-9]{64})/)![1];
    await post(
      "/api/register/verify",
      { token, password, role: "REGISTRAR" },
      400,
    );
    await post("/api/register/verify", { token, password }, 200);
    await post("/api/register/verify", { token, password }, 400);
    const signedIn = await post(
      "/api/auth",
      { email: student.email, password },
      200,
    );
    const cookie = signedIn.headers.get("set-cookie")!.split(";")[0];
    const identity = await (
      await fetch(origin + "/api/auth", { headers: { cookie } })
    ).json();
    assert.equal(identity.identity.role, "STUDENT");
    const snapshotResponse = await fetch(origin + "/api/edm", {
      headers: { cookie },
    });
    const snapshot = await snapshotResponse.json();
    assert.equal(snapshot.masterRecords.length, 1);
    assert.equal(snapshot.masterRecords[0].studentId, student.studentId);
    checks++;
    const forbidden = await fetch(origin + "/api/edm", {
      method: "POST",
      headers: { cookie, origin, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sync" }),
    });
    assert.equal(forbidden.status, 403);
    checks++;
    const logout = await fetch(origin + "/api/auth", {
      method: "DELETE",
      headers: { cookie, origin },
    });
    assert.equal(logout.status, 200);
    checks++;
    console.log(
      `Student registration HTTP smoke passed: ${checks} checks; frontend 3005, backend 3006, no real email sent.`,
    );
  } finally {
    await services.stop();
    await closeDatabase();
    const resolved = path.resolve(directory);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith("unidata-registration-http-")
    )
      throw new Error("Unexpected preview cleanup path");
    await rm(resolved, { recursive: true, force: true });
  }
}
main().catch(async () => {
  await closeDatabase();
  console.error(
    "Registration HTTP smoke failed. Check isolated database setup, service ports, and registration behavior.",
  );
  process.exitCode = 1;
});
