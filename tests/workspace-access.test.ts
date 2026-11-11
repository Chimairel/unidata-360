import { test } from "node:test";
import assert from "node:assert/strict";
import {
  workspaceTabs,
  defaultWorkspaceTab,
  effectiveWorkspaceTab,
  type TabId,
} from "../frontend/lib/workspaceAccess";
import type { UserRole } from "../shared/types";

test("each role has its own permitted workspace and starting page", () => {
  const expected: Record<UserRole, readonly TabId[]> = {
    DEAN_REGISTRAR: ["student360", "pipeline", "analytics", "governance"],
    ACADEMIC_ADVISOR: ["student360", "analytics", "governance"],
    STUDENT: ["student360"],
    COMPLIANCE_AUDITOR: ["governance", "student360"],
  };
  for (const role of Object.keys(expected) as UserRole[]) {
    assert.deepEqual(workspaceTabs(role), expected[role]);
    assert.equal(defaultWorkspaceTab(role), expected[role][0]);
    for (const tab of [
      "student360",
      "pipeline",
      "analytics",
      "governance",
    ] as TabId[])
      assert.ok(workspaceTabs(role).includes(effectiveWorkspaceTab(role, tab)));
  }
});
test("switching role cannot leave staff content selected for a student or auditor", () => {
  assert.equal(effectiveWorkspaceTab("STUDENT", "pipeline"), "student360");
  assert.equal(effectiveWorkspaceTab("STUDENT", "governance"), "student360");
  assert.equal(
    effectiveWorkspaceTab("COMPLIANCE_AUDITOR", "analytics"),
    "governance",
  );
  assert.equal(
    effectiveWorkspaceTab("ACADEMIC_ADVISOR", "pipeline"),
    "student360",
  );
});
