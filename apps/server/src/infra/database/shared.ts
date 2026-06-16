import { files, users } from "@shamt/database/models";
import { internalServerError } from "@/shared/exceptions";
import type { RuntimeConfig } from "@/infra/env";

export const databaseSchema = {
  files,
  users,
};

export type DatabaseSchema = typeof databaseSchema;
export type DatabaseRuntimeStrategy = {
  provider: RuntimeConfig["APP_DATABASE_PROVIDER"];
  runtime: RuntimeConfig["APP_RUNTIME"];
};

/**
 * Returns the configured database strategy and rejects runtime/provider pairs
 * that cannot be executed by the current infrastructure.
 */
export function getDatabaseEnvConfig(
  config: RuntimeConfig,
): DatabaseRuntimeStrategy {
  return {
    provider: config.APP_DATABASE_PROVIDER,
    runtime: config.APP_RUNTIME,
  };
}

/**
 * Reads the database URL from validated runtime env with DATABASE_URL fallback
 * for local Node tooling.
 */
export function getDatabaseUrl(config: RuntimeConfig): string {
  const url =
    config.APP_DATABASE_URL ??
    (typeof process === "undefined" ? undefined : process.env.DATABASE_URL);

  if (!url) {
    throw internalServerError("APP_DATABASE_URL is required", {
      expose: true,
    });
  }

  return url;
}
