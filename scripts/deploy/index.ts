import { configSchema, DEFAULT_RUNTIMES } from "@shamt/app-env";
import { executeCommand } from "@shamt/node-utils/execute-command";
import { throwError } from "../utils";

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
