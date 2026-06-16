import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { runtimeNotSupported } from "@/utils/runtime";
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

let processDatabase: ProcessDatabase | undefined;

/**
 * Reuses the selected process database client across Node requests.
 * The cached Postgres pool is released by disposeProcessDatabase().
 */
export async function getProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  processDatabase ??= await createProcessDatabase(config);
  return processDatabase;
}

/**
 * Creates the Node process database strategy.
 * Node supports Postgres through pg.Pool; node + d1 is intentionally reserved
 * and fails with runtimeNotSupported until a local D1 strategy is introduced.
 */
export async function createProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  const strategy = getDatabaseEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    return runtimeNotSupported({
      mode: "throw",
      runtime: config.APP_RUNTIME,
      message: "D1 database is not implemented for Node runtime yet",
    });
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

  await database?.dispose();
}
