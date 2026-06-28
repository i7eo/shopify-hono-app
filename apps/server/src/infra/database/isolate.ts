import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { internalServerError } from "@/shared/exceptions";
import {
  getDatabaseEnvConfig,
  sqliteDatabaseSchema,
  type SqliteDatabaseSchema,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export type IsolateD1Database = {
  db: DrizzleD1Database<SqliteDatabaseSchema>;
  dialect: "sqlite";
  provider: typeof DEFAULT_APP_DATABASE_PROVIDERS.D1;
  runtime: RuntimeConfig["APP_RUNTIME"];
};
export type IsolateDatabase = IsolateD1Database;
export type IsolateDatabaseOptions = {
  d1?: D1Database;
};

/**
 * Creates an isolate-safe Drizzle database client from request-bound bindings.
 */
export async function createIsolateDatabase(
  config: RuntimeConfig,
  options: IsolateDatabaseOptions = {},
): Promise<IsolateDatabase> {
  getDatabaseEnvConfig(config);

  const { drizzle } = await import("drizzle-orm/d1");
  return {
    db: drizzle(requireD1(options.d1), { schema: sqliteDatabaseSchema }),
    dialect: "sqlite",
    provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
    runtime: config.APP_RUNTIME,
  };
}

/**
 * Reserved disposer for isolate database resources.
 * Current Cloudflare D1 clients are request-bound.
 */
export function disposeIsolateDatabase() {
  return Promise.resolve();
}

/**
 * Requires the D1 binding at the database capability boundary.
 */
function requireD1(value: D1Database | undefined): D1Database {
  if (!value) {
    throw internalServerError("Cloudflare D1 binding is required", {
      expose: true,
    });
  }

  return value;
}
