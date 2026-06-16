import type { RuntimeConfig } from "@/infra/env";

/**
 * Reads logger settings shared by all runtimes without importing runtime-specific code.
 */
export function getLoggerEnvConfig(config: RuntimeConfig) {
  return {
    expire: config.APP_LOGGER_EXPIRE,
    level: config.APP_LOGGER_LEVEL,
    maxSize: config.APP_LOGGER_MAX_SIZE,
  };
}
