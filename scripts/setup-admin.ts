import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAccount } from "../backend/auth";
import { audit, closeDatabase, first, transaction } from "../backend/store";
loadEnvConfig(resolve(import.meta.dirname, "../backend"), true);

async function main() {
  const email = "admin@cpc.edu";
  const directory = resolve(
    process.env.EDM_ACCOUNT_DIRECTORY ||
      resolve(import.meta.dirname, "../accounts"),
  );
  const existing = await first<{ id: string; role: string }>(
    "SELECT id,role FROM users WHERE email=?",
    email,
  );
  if (existing) {
    if (existing.role !== "SYSTEM_ADMIN")
      throw new Error(
        "The admin email already belongs to another role. Use account:create to provision a separate administrator.",
      );
    console.log(
      "System Admin already exists. Use its existing password or account:password; no credentials were changed.",
    );
    return;
  }
  const password = randomBytes(24).toString("base64url");
  await transaction(async () => {
    const admin = await createAccount({
      email,
      displayName: "CPC System Administrator",
      role: "SYSTEM_ADMIN",
      password,
    });
    await audit(
      "SYSTEM_ADMIN",
      "ACCOUNT_CREATED",
      `Staff account ${admin.id}`,
      "Provisioned the first classroom System Admin through the local setup command.",
      "ALLOWED",
      {
        mode: "account",
        userId: admin.id,
        displayName: "CPC System Administrator",
      },
    );
  });
  await mkdir(directory, { recursive: true });
  const block = `\nSystem Admin (staff account management)\nEmail: ${email}\nPassword: ${password}\nSign in at http://localhost:3005/login\n`;
  await writeFile(
    resolve(directory, "admin.private.txt"),
    "Estante | Private synthetic System Admin account\n" + block,
    { mode: 0o600 },
  );
  for (const name of [
    "shared.private.txt",
    "development.private.txt",
    "online.private.txt",
  ]) {
    let content = "Estante | Private classroom account guide\n";
    try {
      content = await readFile(resolve(directory, name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(resolve(directory, name), content + block, { mode: 0o600 });
  }
  console.log(
    "System Admin created. Credentials are saved privately in accounts/admin.private.txt; no password was printed.",
  );
}
main()
  .finally(closeDatabase)
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Admin setup failed.",
    );
    process.exitCode = 1;
  });
