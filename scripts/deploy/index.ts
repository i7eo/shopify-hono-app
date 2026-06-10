import { spawn } from "node:child_process";
import { configSchema, DEFAULT_RUNTIMES } from "@shamt/app-env";
import { throwError } from "@shamt/utils";

/**
 * Execute a child process from the current workspace root.
 */
async function executeCommand(command: string, args: readonly string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code}`
          }`,
        ),
      );
    });
  });
}

/**
 * Dispatch the runtime-specific deployment owned by apps/server.
 */
async function main() {
  const config = configSchema.parse(process.env);

  if (config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE) {
    await executeCommand("pnpm", ["-F", "@shamt/server", "cf:deploy"]);
    return;
  }

  if (config.APP_RUNTIME === DEFAULT_RUNTIMES.NODE) {
    await executeCommand("pnpm", ["-F", "@shamt/server", "node:deploy"]);
    return;
  }

  throwError("deploy", `Unsupported APP_RUNTIME: ${config.APP_RUNTIME}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
