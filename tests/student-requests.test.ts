import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createAccount,
  authenticate,
  issueSession,
  readSession,
  type SessionIdentity,
} from "../backend/auth";
import {
  requestStudentRegistration,
  verifyStudentRegistration,
  registrationRequest,
} from "../backend/registration";
import {
  registrationWorkspace,
  reviewStudentRequest,
} from "../backend/studentRequests";
import {
  closeDatabase,
  execute,
  first,
  masters,
  snapshot,
  upsert,
  sync,
  auditTrail,
} from "../backend/store";
import { initialSISRecords } from "../backend/data/mockData";
const url = process.env.EDM_TEST_DATABASE_URL;
if (url && url === process.env.DATABASE_URL)
  throw Error("Use an isolated test database");
if (url) process.env.DATABASE_URL = url;
const dbTest = url ? test : test.skip;
after(closeDatabase);
test("student request input validates name/department and rejects privileged fields", () => {
  const details = {
    studentId: "20990001",
    email: "new@example.edu",
    fullName: "New Student",
    department: "BSIT",
  };
  assert.ok(registrationRequest.safeParse(details).success);
  for (const extra of [
    { role: "REGISTRAR" },
    { active: true },
    { department: "MEDICINE" },
    { fullName: "" },
  ])
    assert.equal(
      registrationRequest.safeParse({ ...details, ...extra }).success,
      false,
    );
  assert.equal(
    registrationRequest.safeParse({
      studentId: "20990001",
      email: "new@example.edu",
      fullName: "New Student",
    }).success,
    false,
  );
});
dbTest(
  "unlisted students verify first, require Registrar approval, and receive no fabricated academic data",
  async () => {
    const previous = { ...process.env };
    const directory = await mkdtemp(
      path.join(tmpdir(), "unidata-student-review-"),
    );
    process.env.EDM_EMAIL_MODE = "preview";
    process.env.EDM_PUBLIC_ORIGIN = "http://localhost:3005";
    process.env.EDM_EMAIL_PREVIEW_DIR = directory;
    delete process.env.VERCEL;
    delete process.env.RAILWAY_PROJECT_ID;
    const password = "Student-review-password-234!";
    const unique = randomUUID().slice(0, 8);
    const registrar = await createAccount({
      email: `review-reg-${unique}@example.edu`,
      displayName: "Review Registrar",
      role: "REGISTRAR",
      password,
    });
    const actor = {
      id: "test-session",
      mode: "account",
      role: "REGISTRAR",
      userId: registrar.id,
      displayName: "Review Registrar",
    } as SessionIdentity;
    async function submit(
      studentId: string,
      email: string,
      department = "BSIT",
    ) {
      const before = new Set(await readdir(directory));
      await execute("DELETE FROM registration_limits");
      await requestStudentRegistration({
        studentId,
        email,
        fullName: "Applicant Student",
        department,
      });
      const messages = await Promise.all(
        (await readdir(directory))
          .filter((f) => !before.has(f))
          .map((f) => readFile(path.join(directory, f), "utf8")),
      );
      return messages
        .findLast(
          (body) =>
            body.startsWith(`To: ${email}\n`) && body.includes("#token="),
        )!
        .match(/#token=([a-f0-9]{64})/)![1];
    }
    try {
      const id = `NEW-${unique}`,
        email = `new-${unique}@example.edu`;
      const token = await submit(id, email);
      assert.equal(
        (await registrationWorkspace(actor)).requests.length,
        0,
        "email must be verified before review",
      );
      assert.deepEqual(await verifyStudentRegistration({ token, password }), {
        ok: true,
        pendingApproval: true,
      });
      await assert.rejects(
        verifyStudentRegistration({ token, password }),
        /invalid or expired/,
      );
      assert.equal((await authenticate(id, password)).ok, false);
      const queue = await registrationWorkspace(actor),
        request = queue.requests.find((r) => r.studentId === id)!;
      assert.equal(request.status, "Pending");
      assert.equal(request.hasSchoolRecord, false);
      assert.equal(JSON.stringify(queue).includes("password_hash"), false);
      for (const role of [
        "SYSTEM_ADMIN",
        "DEAN",
        "ACADEMIC_ADVISOR",
        "STUDENT",
        "COMPLIANCE_AUDITOR",
      ] as const) {
        await assert.rejects(registrationWorkspace({ ...actor, role }));
        await assert.rejects(
          reviewStudentRequest(
            { ...actor, role },
            { id: request.id, decision: "approve" },
          ),
        );
      }
      await assert.rejects(registrationWorkspace({ ...actor, mode: "demo" }));
      await assert.rejects(
        reviewStudentRequest(actor, {
          id: request.id,
          decision: "approve",
          role: "REGISTRAR",
        }),
      );
      await reviewStudentRequest(actor, {
        id: request.id,
        decision: "approve",
        note: "Enrollment confirmed",
      });
      const login = await authenticate(id, password);
      assert.equal(login.ok, true);
      if (!login.ok) throw Error("Login should work");
      assert.equal(login.role, "STUDENT");
      const session = await readSession(
        (await issueSession("STUDENT", login.userId)).token,
      );
      const view = await snapshot("STUDENT", session!);
      assert.equal(view.studentProfile?.studentId, id);
      assert.equal(view.studentProfile?.department, "BSIT");
      assert.equal(view.masterRecords.length, 0);
      assert.equal(view.auditLogs.length, 0);
      assert.equal(view.interventions.length, 0);
      assert.equal((await masters(id)).length, 0);
      assert.equal(
        (await first<{ password_hash: string | null }>(
          "SELECT password_hash FROM student_access_requests WHERE id=?",
          request.id,
        ))!.password_hash,
        null,
      );
      await assert.rejects(
        reviewStudentRequest(actor, { id: request.id, decision: "approve" }),
        /already been reviewed/,
      );
      assert.equal(
        (await authenticate(email, password)).ok,
        false,
        "students sign in by school ID",
      );
      const rejectedId = `REJECT-${unique}`,
        rejectedEmail = `reject-${unique}@example.edu`;
      await verifyStudentRegistration({
        token: await submit(rejectedId, rejectedEmail),
        password,
      });
      const rejected = (await registrationWorkspace(actor)).requests.find(
        (r) => r.studentId === rejectedId,
      )!;
      await assert.rejects(
        reviewStudentRequest(actor, {
          id: rejected.id,
          decision: "reject",
          note: "",
        }),
        /at least 5/,
      );
      await reviewStudentRequest(actor, {
        id: rejected.id,
        decision: "reject",
        note: "Enrollment could not be confirmed",
      });
      assert.equal((await authenticate(rejectedId, password)).ok, false);
      assert.equal(
        (await first<{ password_hash: string | null }>(
          "SELECT password_hash FROM student_access_requests WHERE id=?",
          rejected.id,
        ))!.password_hash,
        null,
      );
      await verifyStudentRegistration({
        token: await submit(rejectedId, rejectedEmail),
        password,
      });
      assert.equal(
        (await registrationWorkspace(actor)).requests.filter(
          (r) => r.studentId === rejectedId,
        ).length,
        2,
        "reapplication retains previous decision",
      );
      const conflictId = `SIS-${unique}`,
        conflictEmail = `sis-${unique}@example.edu`;
      await verifyStudentRegistration({
        token: await submit(conflictId, conflictEmail),
        password,
      });
      const conflict = (await registrationWorkspace(actor)).requests.find(
        (r) => r.studentId === conflictId,
      )!;
      const sis = {
        ...initialSISRecords[0],
        studentId: conflictId,
        email: "different@example.edu",
        department: "BSIT",
      };
      await upsert("SIS", [sis], actor);
      await sync(actor);
      await assert.rejects(
        reviewStudentRequest(actor, { id: conflict.id, decision: "approve" }),
        /differs from SIS/,
      );
      await upsert("SIS", [{ ...sis, email: conflictEmail }], actor);
      await sync(actor);
      await reviewStudentRequest(actor, {
        id: conflict.id,
        decision: "approve",
      });
      const registered = await first<{ display_name: string }>(
        "SELECT display_name FROM users WHERE student_id=?",
        conflictId,
      );
      assert.equal(
        registered!.display_name,
        "Marcus Vance",
        "published school name remains authoritative",
      );
      const trail = await auditTrail();
      assert.equal(trail.valid, true);
      assert.ok(
        trail.entries.some(
          (e) =>
            e.action === "STUDENT_ACCESS_APPROVED" &&
            e.actorId === actor.userId,
        ),
      );
      assert.ok(
        trail.entries.some((e) => e.action === "STUDENT_ACCESS_REJECTED"),
      );
      const messages = await Promise.all(
        (await readdir(directory)).map((f) =>
          readFile(path.join(directory, f), "utf8"),
        ),
      );
      assert.ok(
        messages.some(
          (body) =>
            body.includes("student access is approved") &&
            body.includes("/login"),
        ),
      );
      assert.equal(
        messages.some((body) => body.includes(password)),
        false,
      );
    } finally {
      process.env = previous;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
