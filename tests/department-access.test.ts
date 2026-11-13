import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessStudent,
  canImport,
  canFollowUp,
  ownAuditOnly,
} from "../backend/access";
import {
  accountSchema,
  createAccount,
  issueSession,
  readSession,
} from "../backend/auth";
import { snapshot, assignIntervention, closeDatabase } from "../backend/store";
import { parseImport } from "../backend/validation";
import { initialSISRecords } from "../backend/data/mockData";
import { DEPARTMENTS, DEPARTMENT_NAMES } from "../shared/school";

if (
  process.env.EDM_TEST_DATABASE_URL &&
  process.env.EDM_TEST_DATABASE_URL === process.env.DATABASE_URL
)
  throw new Error("Use an isolated PostgreSQL test database.");

test("department access fails closed and never treats a Dean as Registrar", () => {
  for (const department of DEPARTMENTS) {
    const identity = { mode: "account" as const, department };
    for (const other of DEPARTMENTS)
      assert.equal(
        canAccessStudent("DEAN", identity, {
          studentId: "A",
          department: other,
        }),
        other === department,
      );
  }
  assert.equal(
    canAccessStudent(
      "DEAN",
      { mode: "account" },
      { studentId: "A", department: "BSIT" },
    ),
    false,
  );
  assert.equal(canImport("DEAN"), false);
  assert.equal(canImport("REGISTRAR"), true);
  assert.equal(canFollowUp("DEAN"), true);
  assert.equal(ownAuditOnly("DEAN"), true);
  assert.equal(
    canAccessStudent(
      "STUDENT",
      { mode: "account", studentId: "A" },
      { studentId: "B", department: "BSIT" },
    ),
    false,
  );
});

test("Dean provisioning and SIS ingestion require recognized departments", () => {
  const base = {
    email: "dean@example.test",
    displayName: "Dean",
    password: "synthetic-test-password-123!",
    role: "DEAN",
  };
  assert.equal(accountSchema.safeParse(base).success, false);
  assert.equal(
    accountSchema.safeParse({ ...base, department: "Other" }).success,
    false,
  );
  for (const department of DEPARTMENTS) {
    assert.equal(
      accountSchema.safeParse({ ...base, department }).success,
      true,
    );
    assert.equal(
      parseImport(
        "SIS",
        JSON.stringify([{ ...initialSISRecords[0], department }]),
        "json",
      ).length,
      1,
    );
  }
  assert.throws(
    () =>
      parseImport(
        "SIS",
        JSON.stringify([{ ...initialSISRecords[0], department: "Other" }]),
        "json",
      ),
    /BSIT/,
  );
  assert.deepEqual(
    [...new Set(initialSISRecords.map((s) => s.department))],
    [...DEPARTMENTS],
  );
  for (const student of initialSISRecords)
    assert.equal(
      student.major,
      DEPARTMENT_NAMES[student.department as keyof typeof DEPARTMENT_NAMES],
    );
});

test(
  "database sessions and snapshots enforce department isolation",
  { skip: !process.env.EDM_TEST_DATABASE_URL },
  async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = process.env.EDM_TEST_DATABASE_URL;
    try {
      for (const department of DEPARTMENTS) {
        const account = await createAccount({
          email: `scope-${department}@example.test`,
          displayName: `${department} Dean`,
          password: "department-test-password-123!",
          role: "DEAN",
          department,
        });
        const issued = await issueSession("DEAN", account.id);
        const identity = await readSession(issued.token);
        assert.equal(identity?.department, department);
        const data = await snapshot("DEAN", identity!);
        assert.equal(data.departmentScope, department);
        assert.equal(data.masterRecords.length, 2);
        assert.equal(data.sourceCounts.SIS, 2);
        assert.equal(data.sourceCounts.LIBRARY, 2);
        assert.ok(
          data.masterRecords.every(
            (s) =>
              s.department === department &&
              s.ssn.startsWith("•••") &&
              s.dateOfBirth.includes("••"),
          ),
        );
        assert.equal(
          data.sisRecords.length +
            data.lmsRecords.length +
            data.libraryRecords.length +
            data.etlReports.length,
          0,
        );
        assert.ok(data.auditLogs.every((e) => e.actorId === account.id));
        const outside = initialSISRecords.find(
          (s) => s.department !== department,
        )!;
        await assert.rejects(
          () => assignIntervention("DEAN", outside.studentId, identity!),
          /unavailable/,
        );
      }
    } finally {
      await closeDatabase();
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  },
);
