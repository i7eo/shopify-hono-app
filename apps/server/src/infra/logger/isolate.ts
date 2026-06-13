import { setupConsoleLogger, type LoggerSetupOptions } from "./shared";
import type { RuntimeConfig } from "@/infra/env";

export function getIsolateLoggerEnvConfig(config: RuntimeConfig) {
  return {
    level: config.APP_LOGGER_LEVEL,
  };
}

/**
 * Configure logger sinks for isolate runtimes such as Cloudflare Workers.
 * Isolate runtimes must avoid persistent file sinks and use console output only.
 */
export async function setupIsolateLogger(
  config: RuntimeConfig,
  options: LoggerSetupOptions,
): Promise<void> {
  await setupConsoleLogger(getIsolateLoggerEnvConfig(config), options);
}
