import {
  files,
  postgresShopifySessions,
} from "@shamt/database/models/postgres";
import {
  sqliteFiles,
  sqliteShopifySessions,
} from "@shamt/database/models/sqlite";
import { internalServerError } from "@/shared/exceptions";
import type { RuntimeConfig } from "@/infra/env";

export const postgresDatabaseSchema = {
  files,
  shopifySessions: postgresShopifySessions,
};

export const sqliteDatabaseSchema = {
  files: sqliteFiles,
  shopifySessions: sqliteShopifySessions,
};

export type PostgresDatabaseSchema = typeof postgresDatabaseSchema;
export type SqliteDatabaseSchema = typeof sqliteDatabaseSchema;
export type DatabaseRuntimeStrategy = {
  provider: RuntimeConfig["APP_DATABASE_PROVIDER"];
  runtime: RuntimeConfig["APP_RUNTIME"];
};

/**
 * Returns the configured database strategy without opening a connection.
 * Runtime factories own support checks because each runtime has different
 * required bindings and connection setup.
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
