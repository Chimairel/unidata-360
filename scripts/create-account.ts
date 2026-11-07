import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAccount, resetPassword } from "../backend/auth";
import { closeDatabase } from "../backend/store";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
loadEnvConfig(resolve("backend"), process.env.NODE_ENV !== "production");

// No default passwords and no command-line password argument or password logging.
async function hiddenPassword(): Promise<string> {
  if (!stdin.isTTY)
    throw new Error("Run account provisioning in an interactive terminal.");
  stdout.write("Password (12–128 characters, input hidden): ");
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = () => {
      stdin.off("data", read);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const read = (chunk: string) => {
      for (const c of chunk) {
        if (c === "\u0003") {
          finish();
          reject(new Error("Cancelled"));
          return;
        }
        if (c === "\r" || c === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else if (c >= " " && value.length < 129) value += c;
      }
    };
    stdin.on("data", read);
  });
}
async function main() {
  if (process.argv.includes("--reset-password")) {
    const rl = createInterface({ input: stdin, output: stdout });
    let email: string;
    try {
      email = await rl.question("Account email: ");
    } finally {
      rl.close();
    }
    await resetPassword(email, await hiddenPassword());
    stdout.write("Password updated. Existing account sessions revoked.\n");
    return;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  let email: string,
    displayName: string,
    role: string,
    studentId: string | undefined;
  try {
    email = await rl.question("Account email: ");
    displayName = await rl.question("Display name: ");
    role = await rl.question(
      "Role (DEAN_REGISTRAR / ACADEMIC_ADVISOR / STUDENT / COMPLIANCE_AUDITOR): ",
    );
    if (role === "STUDENT")
      studentId = await rl.question("Linked student ID: ");
  } finally {
    rl.close();
  }
  const password = await hiddenPassword();
  const created = await createAccount({
    email,
    displayName,
    role,
    studentId,
    password,
  });
  const origin =
    process.env.EDM_PUBLIC_ORIGIN ||
    (process.env.RAILWAY_PUBLIC_DOMAIN &&
      `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`) ||
    "http://localhost:3005";
  stdout.write(
    `Created ${created.email} (${created.role}). Sign in at ${origin}/login\n`,
  );
}
main()
  .finally(closeDatabase)
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Account creation failed");
    process.exitCode = 1;
  });
