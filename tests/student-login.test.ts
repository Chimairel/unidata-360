import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loginSchema } from "../backend/api/auth";
import {
  createAccount,
  authenticate,
  issueSession,
  readSession,
  resetPassword,
  tokenHash,
} from "../backend/auth";
import {
  requestStudentPasswordReset,
  resetStudentPassword,
} from "../backend/passwordRecovery";
import { closeDatabase, execute, first, auditTrail } from "../backend/store";
import { sendPasswordResetEmail } from "../backend/email";

const testUrl = process.env.EDM_TEST_DATABASE_URL;
if (testUrl && testUrl === process.env.DATABASE_URL)
  throw new Error("Use an isolated PostgreSQL test database.");

test("login accepts school IDs or staff email, requires a password and rejects role injection", () => {
  for (const identifier of [
    "STU-2024-001",
    "2024-12345",
    "123456",
    "dean@cpc.edu",
  ])
    assert.equal(
      loginSchema.safeParse({ identifier, password: "test-password" }).success,
      true,
    );
  for (const input of [
    { identifier: "STU-2024-001" },
    { identifier: "", password: "x" },
    { identifier: "x y", password: "x" },
    { identifier: "A", password: "x", role: "REGISTRAR" },
    { identifier: "A", email: "x@example.edu", password: "x" },
  ])
    assert.equal(loginSchema.safeParse(input).success, false);
});

test("password reset delivery uses Resend and a fragment token without disclosing school records", async () => {
  const previous = { ...process.env },
    fetch = globalThis.fetch;
  Object.assign(process.env, {
    EDM_EMAIL_MODE: "resend",
    RESEND_API_KEY: "test-only-not-real",
    EDM_EMAIL_FROM: "UniData <accounts@example.edu>",
    EDM_PUBLIC_ORIGIN: "https://school.example.test",
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.subject, "Reset your UniData 360 student password");
    assert.deepEqual(body.to, ["student@example.test"]);
    assert.ok(body.text.includes(`/reset-password#token=${"a".repeat(64)}`));
    assert.ok(!body.text.includes("GPA"));
    return Response.json({ id: "test-message" });
  };
  try {
    await sendPasswordResetEmail("student@example.test", "a".repeat(64));
  } finally {
    process.env = previous;
    globalThis.fetch = fetch;
  }
});

test(
  "student ID login and email recovery preserve identity, throttle aliases, reject expired links and revoke sessions",
  { skip: !testUrl },
  async () => {
    const previous = { ...process.env };
    process.env.DATABASE_URL = testUrl;
    const directory = await mkdtemp(path.join(tmpdir(), "unidata-recovery-"));
    Object.assign(process.env, {
      EDM_EMAIL_MODE: "preview",
      EDM_EMAIL_PREVIEW_DIR: directory,
      EDM_PUBLIC_ORIGIN: "http://localhost:3005",
    });
    delete process.env.VERCEL;
    delete process.env.RAILWAY_PROJECT_ID;
    const password = "Original-student-password-123!",
      next = "Replacement-student-password-456!";
    const email = "recovery.student@example.test",
      studentId = "STU-2024-001";
    try {
      const account = await createAccount({
        email,
        displayName: "Recovery Student",
        role: "STUDENT",
        studentId,
        password,
      });
      assert.equal(
        (await authenticate(` ${studentId.toLowerCase()} `, password)).ok,
        true,
      );
      assert.equal((await authenticate(email, password)).ok, false);
      assert.equal((await authenticate(studentId, "wrong")).ok, false);
      for (let n = 0; n < 3; n++)
        await authenticate(studentId.toLowerCase(), "wrong");
      assert.deepEqual(await authenticate(studentId, password), {
        ok: false,
        locked: true,
      });
      const existing = await issueSession("STUDENT", account.id);
      const unknown = await requestStudentPasswordReset({
        studentId: "UNKNOWN",
        email: "unknown@example.test",
      });
      const sent = await requestStudentPasswordReset({ studentId, email });
      assert.deepEqual(sent, unknown);
      await assert.rejects(
        () =>
          requestStudentPasswordReset({
            studentId: studentId.toLowerCase(),
            email,
          }),
        /Please wait/,
      );
      const messages = await readdir(directory);
      assert.equal(messages.length, 1);
      const token = (
        await readFile(path.join(directory, messages[0]), "utf8")
      ).match(/#token=([a-f0-9]{64})/)![1];
      const stored = await first<{ token_hash: string }>(
        "SELECT token_hash FROM password_resets WHERE user_id=?",
        account.id,
      );
      assert.equal(stored!.token_hash, tokenHash(token));
      assert.notEqual(stored!.token_hash, token);
      await execute(
        "UPDATE password_resets SET expires_at=0 WHERE user_id=?",
        account.id,
      );
      await assert.rejects(
        () => resetStudentPassword({ token, password: next }),
        /invalid or expired/,
      );
      await execute(
        "UPDATE password_resets SET expires_at=? WHERE user_id=?",
        Date.now() + 60000,
        account.id,
      );
      await execute(
        "UPDATE users SET email=? WHERE id=?",
        "changed@example.test",
        account.id,
      );
      await assert.rejects(
        () => resetStudentPassword({ token, password: next }),
        /invalid or expired/,
      );
      await execute("UPDATE users SET email=? WHERE id=?", email, account.id);
      await resetStudentPassword({ token, password: next });
      assert.equal(await readSession(existing.token), null);
      assert.equal((await authenticate(studentId, password)).ok, false);
      assert.equal((await authenticate(studentId, next)).ok, true);
      await assert.rejects(
        () => resetStudentPassword({ token, password: next }),
        /invalid or expired/,
      );
      assert.equal((await auditTrail()).valid, true);
      await execute("DELETE FROM registration_limits");
      await requestStudentPasswordReset({ studentId, email });
      await resetPassword(email, password);
      assert.equal(
        await first(
          "SELECT 1 FROM password_resets WHERE user_id=?",
          account.id,
        ),
        undefined,
      );
    } finally {
      await closeDatabase();
      process.env = previous;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
