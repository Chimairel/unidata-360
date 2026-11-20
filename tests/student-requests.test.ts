import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createAccount,
  authenticate,
  issueSession,
  readSession,
  tokenHash,
  type SessionIdentity,
} from "../backend/auth";
import {
  requestStudentActivation,
  studentContact,
  verifyStudentActivation,
} from "../backend/registration";
import {
  manageStudentAccounts,
  provisionStudentAccounts,
  studentAccountsWorkspace,
} from "../backend/studentAccounts";
import {
  requestStudentPasswordReset,
  resetStudentPassword,
} from "../backend/passwordRecovery";
import {
  closeDatabase,
  execute,
  first,
  upsert,
  auditTrail,
} from "../backend/store";
import { initialSISRecords } from "../backend/data/mockData";

const url = process.env.EDM_TEST_DATABASE_URL;
if (url && url === process.env.DATABASE_URL)
  throw Error("Use an isolated test database");
if (url) process.env.DATABASE_URL = url;
const dbTest = url ? test : test.skip;
after(closeDatabase);

test("activation accepts school ID and enrollment email and rejects self-provisioning fields", () => {
  const contact = { studentId: " 20990001 ", email: " Student@Example.edu " };
  assert.deepEqual(studentContact.parse(contact), {
    studentId: "20990001",
    email: "student@example.edu",
  });
  assert.equal(
    studentContact.safeParse({
      ...contact,
      fullName: "Fake Name",
      department: "BSIT",
    }).success,
    false,
  );
  assert.equal(
    studentContact.safeParse({ ...contact, role: "REGISTRAR" }).success,
    false,
  );
});

dbTest(
  "Registrar provisions idempotently, gates pending sessions and corrects email without carrying over old links",
  async () => {
    const previous = { ...process.env };
    const directory = await mkdtemp(path.join(tmpdir(), "estante-activation-"));
    Object.assign(process.env, {
      EDM_EMAIL_MODE: "preview",
      EDM_EMAIL_PREVIEW_DIR: directory,
      EDM_PUBLIC_ORIGIN: "http://localhost:3005",
      EDM_AUTH_MODE: "accounts",
    });
    delete process.env.VERCEL;
    delete process.env.RAILWAY_PROJECT_ID;
    const password = "Enrollment-activation-only-993!";
    const student = {
      ...initialSISRecords[0],
      studentId: "ENR-20990001",
      email: "roster-student@example.test",
    };
    const corrected = "corrected-roster-student@example.test";
    const finalEmail = "updated-roster-student@example.test";
    const duplicateEmail = "shared-roster-email@example.test";
    const duplicateRows = [
      { ...student, studentId: "ENR-20990002", email: duplicateEmail },
      { ...student, studentId: "ENR-20990003", email: duplicateEmail },
    ];
    const suspended = {
      ...student,
      studentId: "ENR-SUSPENDED",
      email: "suspended-roster@example.test",
      enrollmentStatus: "Suspended" as const,
    };
    async function tokenFor(email: string, route: string) {
      for (const name of await readdir(directory)) {
        const content = await readFile(path.join(directory, name), "utf8");
        if (content.startsWith(`To: ${email}\n`) && content.includes(route))
          return content.match(/#token=([a-f0-9]{64})/)![1];
      }
      assert.fail("Expected a matching preview");
    }
    try {
      const registrar = await createAccount({
        email: "enrollment-registrar@example.test",
        displayName: "Enrollment Registrar",
        role: "REGISTRAR",
        password,
      });
      const identity: SessionIdentity = {
        id: registrar.id,
        userId: registrar.id,
        mode: "account",
        role: "REGISTRAR",
      };
      await upsert("SIS", [student, ...duplicateRows, suspended]);
      const ids = new Set(
        [student, ...duplicateRows, suspended].map((item) =>
          item.studentId.toLowerCase(),
        ),
      );
      const before = await studentAccountsWorkspace(identity);
      await assert.rejects(
        () =>
          provisionStudentAccounts(
            { ...identity, role: "ACADEMIC_ADVISOR" },
            ids,
          ),
        /permitted staff/,
      );
      assert.deepEqual(await provisionStudentAccounts(identity, ids), {
        created: 1,
        conflicts: 2,
      });
      assert.deepEqual(await provisionStudentAccounts(identity, ids), {
        created: 0,
        conflicts: 2,
      });
      assert.equal(
        (await studentAccountsWorkspace(identity)).pending,
        before.pending + 1,
      );

      const pending = await first<{ id: string; password_hash: string }>(
        "SELECT id,password_hash FROM users WHERE student_id=?",
        student.studentId,
      );
      assert.equal(pending?.password_hash, "");
      assert.equal((await authenticate(student.studentId, "123456")).ok, false);
      await assert.rejects(
        () => issueSession("STUDENT", pending!.id),
        /not ready/,
      );
      const staleSession = "a".repeat(64);
      await execute(
        "INSERT INTO sessions(id,role,expires_at,user_id) VALUES(?,'STUDENT',?,?)",
        tokenHash(staleSession),
        Date.now() + 60000,
        pending!.id,
      );
      assert.equal(await readSession(staleSession), null);
      const details = { studentId: student.studentId, email: student.email };
      await assert.rejects(
        () => requestStudentPasswordReset(details),
        /not been activated yet/,
      );
      assert.equal((await readdir(directory)).length, 0);
      await requestStudentActivation(details);
      const oldToken = await tokenFor(student.email, "/register#token=");
      await assert.rejects(
        () =>
          manageStudentAccounts(identity, {
            type: "update-email",
            studentId: student.studentId,
            email: corrected,
            identityConfirmed: false,
          }),
        /verified the student's identity/,
      );
      await manageStudentAccounts(identity, {
        type: "update-email",
        studentId: student.studentId,
        email: corrected,
        identityConfirmed: true,
      });
      await assert.rejects(
        () => verifyStudentActivation({ token: oldToken, password }),
        /invalid or expired/,
      );
      await requestStudentActivation({ ...details, email: corrected });
      await verifyStudentActivation({
        token: await tokenFor(corrected, "/register#token="),
        password,
      });
      assert.equal(await readSession(staleSession), null);
      assert.equal((await authenticate(student.studentId, password)).ok, true);
      assert.equal(
        (await studentAccountsWorkspace(identity)).active,
        before.active + 1,
      );
      const active = await first<{ id: string; password_hash: string }>(
        "SELECT id,password_hash FROM users WHERE student_id=?",
        student.studentId,
      );
      assert.equal(active?.id, pending?.id);
      assert.deepEqual(await provisionStudentAccounts(identity, ids), {
        created: 0,
        conflicts: 2,
      });
      assert.deepEqual(
        await first(
          "SELECT id,password_hash FROM users WHERE student_id=?",
          student.studentId,
        ),
        active,
      );

      const session = await issueSession("STUDENT", active!.id);
      await requestStudentPasswordReset({ ...details, email: corrected });
      const resetToken = await tokenFor(corrected, "/reset-password#token=");
      await manageStudentAccounts(identity, {
        type: "update-email",
        studentId: student.studentId,
        email: finalEmail,
        identityConfirmed: true,
      });
      assert.equal(await readSession(session.token), null);
      await assert.rejects(
        () => resetStudentPassword({ token: resetToken, password }),
        /invalid or expired/,
      );
      assert.equal((await authenticate(student.studentId, password)).ok, true);
      assert.equal((await auditTrail()).valid, true);
    } finally {
      process.env = previous;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
