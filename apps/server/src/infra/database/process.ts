import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import {
  getDatabaseEnvConfig,
  getDatabaseUrl,
  postgresDatabaseSchema,
  sqliteDatabaseSchema,
  type PostgresDatabaseSchema,
  type SqliteDatabaseSchema,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type ProcessPostgresDatabase = {
  db: NodePgDatabase<PostgresDatabaseSchema>;
  dialect: "postgres";
  dispose: () => Promise<void>;
  provider: typeof DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES;
  runtime: RuntimeConfig["APP_RUNTIME"];
};
export type ProcessD1Database = {
  db: DrizzleD1Database<SqliteDatabaseSchema>;
  dialect: "sqlite";
  dispose: () => Promise<void>;
  provider: typeof DEFAULT_APP_DATABASE_PROVIDERS.D1;
  runtime: RuntimeConfig["APP_RUNTIME"];
};
export type ProcessDatabase = ProcessPostgresDatabase | ProcessD1Database;

let processDatabase: Promise<ProcessDatabase> | undefined;
let processDatabaseCacheKey: string | undefined;

/**
 * Reuses the selected process database client across Node requests.
 *
 * Caches the in-flight Promise (not the resolved value) and assigns it
 * synchronously, so concurrent first calls share one creation instead of
 * racing into multiple pools. Re-created when the connection identity changes;
 * the cached Postgres pool is released by disposeProcessDatabase().
 */
export function getProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  const cacheKey = getProcessDatabaseCacheKey(config);

  if (!processDatabase || processDatabaseCacheKey !== cacheKey) {
    processDatabase = createProcessDatabase(config);
    processDatabaseCacheKey = cacheKey;
  }

  return processDatabase;
}

/**
 * Creates the Node process database strategy.
 * Node supports Postgres through pg.Pool and D1 through Cloudflare's HTTP API.
 */
export async function createProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  const strategy = getDatabaseEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    const [{ drizzle }, { createProcessD1HttpClient }] = await Promise.all([
      import("drizzle-orm/d1"),
      import("./process.d1-http"),
    ]);

    return {
      db: drizzle(createProcessD1HttpClient(config), {
        schema: sqliteDatabaseSchema,
      }),
      dialect: "sqlite",
      dispose: () => Promise.resolve(),
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: config.APP_RUNTIME,
    };
  }

  const [{ drizzle }, { Pool }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
  ]);
  const pool = new Pool({ connectionString: getDatabaseUrl(config) });

  return {
    db: drizzle({ client: pool, schema: postgresDatabaseSchema }),
    dialect: "postgres",
    dispose: () => pool.end(),
    provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
    runtime: config.APP_RUNTIME,
  };
}

/**
 * Closes the cached process database client and clears its runtime cache.
 */
export async function disposeProcessDatabase(): Promise<void> {
  const database = processDatabase;
  processDatabase = undefined;
  processDatabaseCacheKey = undefined;

  await (await database)?.dispose();
}

/**
 * Builds the process database cache key from the fields that change the
 * connection identity, so a config switch rebuilds the client.
 */
function getProcessDatabaseCacheKey(config: RuntimeConfig): string {
  const strategy = getDatabaseEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    return [
      strategy.provider,
      config.APP_CLOUDFLARE_WORKER_ACCOUNT_ID,
      config.APP_DATABASE_D1_ID,
      config.APP_CLOUDFLARE_USER_TOKEN,
    ].join(":");
  }

  return [strategy.provider, getDatabaseUrl(config)].join(":");
}
