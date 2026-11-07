import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");

export function startServices(mode, env = process.env, captureOutput = false) {
  if (!["dev", "start"].includes(mode)) throw new Error("Use dev or start.");
  const children = ["backend", "frontend"].map((directory) =>
    spawn(
      process.execPath,
      [next, mode, "-p", directory === "backend" ? "3006" : "3005"],
      {
        cwd: resolve(root, directory),
        env,
        stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
      },
    ),
  );
  let stopping;
  async function stop() {
    stopping ??= Promise.all(
      children.map(async (child) => {
        if (!child.pid || child.exitCode !== null || child.signalCode !== null)
          return;
        const exited = once(child, "exit");
        if (process.platform === "win32") {
          // Terminate only this launch's process tree, including Next.js workers.
          const terminator = spawn(
            "taskkill",
            ["/PID", String(child.pid), "/T", "/F"],
            {
              stdio: "ignore",
              windowsHide: true,
            },
          );
          await once(terminator, "exit");
        } else {
          child.kill("SIGTERM");
        }
        await exited;
      }),
    );
    await stopping;
  }
  return { children, stop };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const services = startServices(process.argv[2]);
  let shuttingDown = false;
  const shutdown = async (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await services.stop();
    process.exitCode = code;
  };
  process.once("SIGINT", () => void shutdown(130));
  process.once("SIGTERM", () => void shutdown(143));
  for (const child of services.children) {
    child.once("error", (error) => {
      console.error(error.message);
      void shutdown(1);
    });
    child.once("exit", (code, signal) => {
      void shutdown(code ?? (signal ? 1 : 0));
    });
  }
}
