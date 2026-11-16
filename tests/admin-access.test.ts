import { test } from "node:test";
import assert from "node:assert/strict";
import { accountCommand, isAccountAdministrator } from "../backend/accounts";
import {
  canAccessStudent,
  canImport,
  canFollowUp,
  canViewAnalytics,
} from "../backend/access";
import {
  workspaceTabs,
  effectiveWorkspaceTab,
} from "../frontend/lib/workspaceAccess";

test("System Admin manages accounts without academic privileges or a demo bypass", () => {
  assert.deepEqual(workspaceTabs("SYSTEM_ADMIN"), ["accounts"]);
  assert.equal(effectiveWorkspaceTab("SYSTEM_ADMIN", "student360"), "accounts");
  assert.equal(effectiveWorkspaceTab("STUDENT", "accounts"), "student360");
  assert.equal(
    canAccessStudent(
      "SYSTEM_ADMIN",
      { mode: "account" },
      { studentId: "A", department: "BSIT" },
    ),
    false,
  );
  assert.equal(canImport("SYSTEM_ADMIN"), false);
  assert.equal(canFollowUp("SYSTEM_ADMIN"), false);
  assert.equal(canViewAnalytics("SYSTEM_ADMIN"), false);
  assert.equal(
    isAccountAdministrator({ mode: "demo", role: "SYSTEM_ADMIN", id: "demo" }),
    false,
  );
  assert.equal(
    isAccountAdministrator({
      mode: "account",
      role: "REGISTRAR",
      userId: "A",
      id: "token",
    }),
    false,
  );
  assert.equal(
    isAccountAdministrator({
      mode: "account",
      role: "SYSTEM_ADMIN",
      userId: "A",
      id: "token",
    }),
    true,
  );
});
test("staff forms reject privileged roles, student links and invalid Dean assignments", () => {
  const base = {
    type: "create",
    displayName: "Staff",
    email: "staff@example.edu",
    password: "synthetic-test-password-123!",
  };
  for (const role of ["STUDENT", "SYSTEM_ADMIN", "UNKNOWN"])
    assert.equal(accountCommand.safeParse({ ...base, role }).success, false);
  assert.equal(
    accountCommand.safeParse({ ...base, role: "DEAN" }).success,
    false,
  );
  assert.equal(
    accountCommand.safeParse({ ...base, role: "DEAN", department: "BSIT" })
      .success,
    true,
  );
  assert.equal(
    accountCommand.safeParse({ ...base, role: "REGISTRAR", department: "BSIT" })
      .success,
    false,
  );
  assert.equal(
    accountCommand.safeParse({
      ...base,
      role: "ACADEMIC_ADVISOR",
      studentId: "A",
    }).success,
    false,
  );
  assert.equal(
    accountCommand.safeParse({ type: "status", id: "A", active: "false" })
      .success,
    false,
  );
  assert.equal(
    accountCommand.safeParse({ type: "password", id: "A", password: "short" })
      .success,
    false,
  );
});
