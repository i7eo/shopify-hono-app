import { getLogger } from "@logtape/logtape";
import { DEFAULT_LOG_LEVEL } from "@shamt/envs";
import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { name } from "../../../package.json";
import { setupConsoleLogger } from "./shared";
import type { RuntimeConfig } from "@/infra/env";

let loggerConfigured = false;

/**
 * Configure a minimal console logger for application bootstrap.
 * This runs before route context exists, so it must not depend on runtime bindings.
 */
export async function setupBootstrapLogger(): Promise<void> {
  if (loggerConfigured) return;

  await setupConsoleLogger(DEFAULT_LOG_LEVEL, { reset: false });
  loggerConfigured = true;
}

/**
 * Configure the runtime logger from a validated runtime config.
 * Process runtimes may enable file sinks, while isolate runtimes stay console-only.
 */
export async function setupLogger(
  config?: RuntimeConfig,
  options: { reset?: boolean } = {},
): Promise<void> {
  const runtimeConfig = config ?? (await getProcessConfig());
  const reset = options.reset ?? loggerConfigured;
  const runtimeLoggerSetup = getRuntimeCapability("runtimeLoggerSetup");

  if (runtimeLoggerSetup) {
    await runtimeLoggerSetup(runtimeConfig, { reset });
  } else {
    await setupConsoleLogger(runtimeConfig.APP_LOGGER_LEVEL, { reset });
  }

  loggerConfigured = true;
}

/**
 * Build a runtime config from process.env when setupLogger is called outside request flow.
 */
async function getProcessConfig(): Promise<RuntimeConfig> {
  const { getRuntimeConfig } = await import("@/infra/env");
  return getRuntimeConfig(process.env);
}

const logger = getLogger([name]);

export type Logger = typeof logger;
export { dispose } from "@logtape/logtape";
export default logger;
