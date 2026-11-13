import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
const base = "http://localhost:3005";
let cookie = "";
let checks = 0;
async function call(path, body, status = 200) {
  const response = await fetch(base + path, {
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json", Origin: base } : {}),
    },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  const set = response.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  assert.equal(
    response.status,
    status,
    `${path}: expected ${status}, got ${response.status}`,
  );
  checks++;
  return response;
}
const initial = await (await call("/api/edm")).json();
assert.equal(initial.masterRecords.length, 8);
const invalid = { ...initial.sisRecords[0], cumulativeGpa: 5 };
await call(
  "/api/edm",
  {
    type: "import",
    feed: "SIS",
    format: "json",
    content: JSON.stringify([invalid]),
  },
  400,
);
const unchanged = await (await call("/api/edm")).json();
assert.deepEqual(unchanged.sisRecords, initial.sisRecords);
await call("/api/edm", {
  type: "import",
  feed: "SIS",
  format: "json",
  content: JSON.stringify([initial.sisRecords[0], initial.sisRecords[0]]),
});
await call("/api/edm", { type: "sync" });
await call("/api/edm", { type: "intervention", studentId: "STU-2024-003" });
const persisted = await (await call("/api/edm")).json();
assert.ok(persisted.interventions.some((i) => i.studentId === "STU-2024-003"));
await call("/api/edm", { type: "role", role: "ACADEMIC_ADVISOR" });
const advisor = await (await call("/api/edm")).json();
assert.equal(advisor.sisRecords.length, 0);
assert.ok(advisor.masterRecords.every((s) => s.ssn.includes("•")));
for (const body of [
  { type: "sync" },
  { type: "reset" },
  { type: "import", feed: "SIS", format: "json", content: "[]" },
])
  await call("/api/edm", body, 403);
await mkdir("tmp/pdfs", { recursive: true });
for (const [url, name] of [
  ["/api/reports?kind=student&studentId=STU-2024-001", "advisor-student"],
  ["/api/reports?kind=analytics", "advisor-analytics"],
]) {
  const response = await call(url);
  assert.ok(response.headers.get("content-type").includes("application/pdf"));
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 1);
  await writeFile(`tmp/pdfs/${name}.pdf`, bytes);
}
await call("/api/edm", { type: "role", role: "STUDENT" });
const student = await (await call("/api/edm")).json();
assert.equal(student.masterRecords.length, 1);
assert.equal(student.auditLogs.length, 0);
assert.equal(student.sisRecords.length, 0);
await call("/api/reports?kind=json&studentId=STU-2024-003", null, 404);
await call("/api/reports?kind=audit", null, 403);
await call("/api/edm", { type: "view", studentId: "STU-2024-003" }, 404);
await call(
  "/api/edm",
  { type: "intervention", studentId: "STU-2024-001" },
  403,
);
await call("/api/edm", { type: "role", role: "COMPLIANCE_AUDITOR" });
const auditor = await (await call("/api/edm")).json();
assert.ok(
  auditor.masterRecords.every(
    (s) =>
      s.fullName.startsWith("Student ") && s.lmsSummary.courses.length === 0,
  ),
);
assert.equal(auditor.auditIntegrity, true);
const csv = await (await call("/api/reports?kind=audit")).text();
assert.ok(csv.includes("SHA256"));
assert.ok(csv.includes("EXPORT_DATA"));
await call("/api/edm", { type: "role", role: "REGISTRAR" });
await call("/api/edm", { type: "reset" });
const cross = await fetch(base + "/api/edm", {
  method: "POST",
  headers: {
    Cookie: cookie,
    Origin: "https://example.com",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "reset" }),
});
assert.equal(cross.status, 400);
checks++;
console.log(
  `PASS: ${checks} live API checks; persistence, role permissions, rejected imports, reports and audit exports verified.`,
);
