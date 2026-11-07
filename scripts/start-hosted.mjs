import { spawn } from "node:child_process";
import { resolve } from "node:path";

const env = { ...process.env };

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (env.EDM_AUTH_MODE !== "accounts" || env.EDM_SECURE_COOKIES !== "true") {
  fail("Hosted UniData requires accounts mode and secure cookies.");
}
let origin;
try {
  origin = new URL(env.EDM_PUBLIC_ORIGIN ?? "");
} catch {
  fail("Set EDM_PUBLIC_ORIGIN to the application's public HTTPS origin.");
}
if (origin.protocol !== "https:" || origin.origin !== env.EDM_PUBLIC_ORIGIN) {
  fail(
    "EDM_PUBLIC_ORIGIN must be an exact HTTPS origin without a trailing slash.",
  );
}
try {
  const database = new URL(env.DATABASE_URL ?? "");
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname ||
    !database.username ||
    database.pathname.length < 2
  ) {
    throw new Error("Invalid PostgreSQL URL");
  }
} catch {
  fail("Set DATABASE_URL to the Neon PostgreSQL connection string.");
}

const child = spawn(
  process.execPath,
  [
    resolve("node_modules/next/dist/bin/next"),
    "start",
    "-H",
    "0.0.0.0",
    "-p",
    "3006",
  ],
  { cwd: resolve("backend"), env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
child.on("error", (error) => fail(error.message));
child.on("exit", (code, signal) =>
  process.exit(code ?? (signal === "SIGINT" ? 130 : 143)),
);
