import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createAccount } from "../backend/auth";
import {
  audit,
  closeDatabase,
  execute,
  first,
  source,
  sync,
  transaction,
  upsert,
} from "../backend/store";
import { initialSISRecords, initialLMSRecords } from "../backend/data/mockData";
import { isDepartment } from "../shared/school";
import type { SISRecord, LMSRecord, UserRole } from "../shared/types";

loadEnvConfig(resolve(import.meta.dirname, "../backend"), true);

// Explicit, repeatable classroom upgrade; preserves passwords, student IDs,
// performance metrics, imported students and the immutable audit history.
async function main() {
  const credentials = new Map<string, string>();
  const privatePath = resolve(
    process.env.EDM_ACCOUNT_DIRECTORY ||
      resolve(import.meta.dirname, "../accounts"),
    "shared.private.txt",
  );
  try {
    const old = await readFile(privatePath, "utf8");
    for (const match of old.matchAll(
      /Email:\s*([^\s]+)\s*\r?\nPassword:\s*([^\r\n]+)/g,
    ))
      credentials.set(match[1], match[2].trim());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const accounts: {
    email: string;
    displayName: string;
    role: UserRole;
    department?: "BSIT" | "BEED" | "BSED" | "BSHM";
    studentId?: string;
  }[] = [
    {
      email: "registrar@cpc.edu",
      displayName: "CPC Registrar",
      role: "REGISTRAR",
    },
    {
      email: "dean@cpc.edu",
      displayName: "BSIT Dean",
      role: "DEAN",
      department: "BSIT",
    },
    ...(["BEED", "BSED", "BSHM"] as const).map((department) => ({
      email: `dean.${department.toLowerCase()}@cpc.edu`,
      displayName: `${department} Dean`,
      role: "DEAN" as const,
      department,
    })),
    {
      email: "advisor@cpc.edu",
      displayName: "CPC Academic Advisor",
      role: "ACADEMIC_ADVISOR",
    },
    {
      email: "student@cpc.edu",
      displayName: "Marcus Vance",
      role: "STUDENT",
      studentId: "STU-2024-001",
    },
    {
      email: "auditor@cpc.edu",
      displayName: "CPC Compliance Auditor",
      role: "COMPLIANCE_AUDITOR",
    },
  ];
  let upgraded = 0;
  await transaction(async () => {
    const rows = await source<SISRecord>("SIS");
    for (const row of rows) {
      const seed = initialSISRecords.find((s) => s.studentId === row.studentId);
      if (seed && !isDepartment(row.department)) {
        await upsert("SIS", [
          { ...row, department: seed.department, major: seed.major },
        ]);
        upgraded++;
      }
    }
    const oldCodes = [
      "CS-301",
      "CS-305",
      "DS-201",
      "CS-202",
      "SE-401",
      "CS-410",
      "CY-301",
      "IS-204",
      "CS-101",
      "CE-401",
      "DS-301",
    ];
    for (const row of await source<LMSRecord>("LMS")) {
      const index = oldCodes.indexOf(row.courseCode);
      const seed = initialLMSRecords[index];
      if (seed?.studentId === row.studentId) {
        // If an operator already imported the new key, preserve that newer row.
        if (
          !(await first(
            "SELECT 1 FROM sources WHERE feed='LMS' AND record_key=?",
            `${row.studentId}:${seed.courseCode}`,
          ))
        )
          await upsert("LMS", [
            {
              ...row,
              courseCode: seed.courseCode,
              courseName: seed.courseName,
            },
          ]);
        await execute(
          "DELETE FROM sources WHERE feed='LMS' AND record_key=?",
          `${row.studentId}:${row.courseCode}`,
        );
        upgraded++;
      }
    }
    if (upgraded) await sync();
    for (const account of accounts) {
      const existing = await first<{
        id: string;
        role: string;
        department: string | null;
      }>("SELECT id,role,department FROM users WHERE email=?", account.email);
      if (existing) {
        if (
          existing.role !== account.role ||
          existing.department !== (account.department || null)
        ) {
          await execute(
            "UPDATE users SET role=?,department=?,display_name=? WHERE id=?",
            account.role,
            account.department || null,
            account.displayName,
            existing.id,
          );
          await execute("DELETE FROM sessions WHERE user_id=?", existing.id);
        }
      } else {
        const password = randomBytes(24).toString("base64url");
        await createAccount({ ...account, password });
        credentials.set(account.email, password);
      }
    }
    await audit(
      "REGISTRAR",
      "IMPORT_DATA",
      "CPC department setup",
      `Configured BSIT, BEED, BSED and BSHM; separated Dean and Registrar accounts; upgraded ${upgraded} synthetic source rows without resetting history.`,
    );
  });
  const content = [
    "UniData 360 | Private synthetic classroom accounts",
    "Use the same shared PostgreSQL database locally and online. Hosting must run the current application version.",
    "Keep this file private; it is excluded from Git.",
    "Students sign in with school ID + password; staff use assigned email + password. Student email is for verification/recovery.",
    ...accounts.flatMap((account) => [
      "",
      `${account.displayName} (${account.role}${account.department ? ` / ${account.department}` : ""})`,
      `Email: ${account.email}`,
      `Password: ${credentials.get(account.email) || "UNCHANGED — use the existing password or npm run account:password"}`,
      ...(account.studentId ? [`Student ID: ${account.studentId}`] : []),
    ]),
    "",
  ].join("\n");
  await mkdir(resolve(privatePath, ".."), { recursive: true });
  for (const name of [
    "shared.private.txt",
    "development.private.txt",
    "online.private.txt",
  ])
    await writeFile(resolve(privatePath, "../", name), content, {
      mode: 0o600,
    });
  console.log(
    `School setup complete: four departments, eight synthetic accounts, ${upgraded} source rows upgraded. Passwords saved privately in accounts/shared.private.txt.`,
  );
}
main()
  .finally(closeDatabase)
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "School setup failed.",
    );
    process.exitCode = 1;
  });
