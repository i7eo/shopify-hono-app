import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import {
  getDatabaseEnvConfig,
  getDatabaseUrl,
  postgresDatabaseSchema,
  type PostgresDatabaseSchema,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type ProcessPostgresDatabase = {
  db: NodePgDatabase<PostgresDatabaseSchema>;
  dialect: "postgres";
  dispose: () => Promise<void>;
  provider: typeof DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES;
  runtime: RuntimeConfig["APP_RUNTIME"];
};
export type ProcessDatabase = ProcessPostgresDatabase;

let processDatabase: Promise<ProcessDatabase> | undefined;
let processDatabaseCacheKey: string | undefined;

/**
 * Reuses the selected process database client across Node requests.
 * The cached Postgres pool is released by disposeProcessDatabase().
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
 * Node supports Postgres through pg.Pool.
 */
export async function createProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  getDatabaseEnvConfig(config);

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
  const database = await processDatabase;
  processDatabase = undefined;
  processDatabaseCacheKey = undefined;

  await database?.dispose();
}

/**
 * Builds the process database cache key from fields that change adapters.
 */
function getProcessDatabaseCacheKey(config: RuntimeConfig): string {
  const strategy = getDatabaseEnvConfig(config);

  return JSON.stringify({
    databaseUrl: getDatabaseUrl(config),
    provider: strategy.provider,
    runtime: strategy.runtime,
  });
}
