import { isIsolateRuntime } from "@/utils";
import type {
  IsolateD1Database,
  IsolateDatabase,
  IsolateDatabaseOptions,
  IsolatePostgresDatabase,
} from "./isolate";
import type { ProcessDatabase, ProcessPostgresDatabase } from "./process";
import type { RuntimeConfig } from "@/infra/env";

export * from "./shared";
export type {
  IsolateD1Database,
  IsolateDatabase,
  IsolateDatabaseOptions,
  IsolatePostgresDatabase,
} from "./isolate";
export type { ProcessDatabase, ProcessPostgresDatabase } from "./process";

export type Database = ProcessDatabase | IsolateDatabase;
export type PostgresDatabase =
  | ProcessPostgresDatabase
  | IsolatePostgresDatabase;
export type D1DatabaseClient = IsolateD1Database;

const ISOLATE_DATABASE_MODULE = "./isolate";
const PROCESS_DATABASE_MODULE = "./process";

/**
 * Creates the runtime-specific Drizzle database client through a dynamic import.
 *
 * Example:
 * - node + postgres -> process pg.Pool client
 * - cloudflare + d1 -> isolate D1 client
 * - cloudflare + postgres -> isolate Hyperdrive Postgres client
 */
export async function createDatabase(
  config: RuntimeConfig,
  isolateOptions?: IsolateDatabaseOptions,
): Promise<Database> {
  if (isIsolateRuntime(config.APP_RUNTIME)) {
    const { createIsolateDatabase } = await import(ISOLATE_DATABASE_MODULE);
    return createIsolateDatabase(config, isolateOptions);
  }

  const { getProcessDatabase } = await import(PROCESS_DATABASE_MODULE);
  return getProcessDatabase(config);
}

/**
 * Disposes cached runtime database clients when the implementation keeps any.
 * Isolate database clients are request-bound today, so their disposer is a
 * no-op by design.
 */
export async function disposeDatabase(
  config: Pick<RuntimeConfig, "APP_RUNTIME">,
): Promise<void> {
  if (isIsolateRuntime(config.APP_RUNTIME)) return;

  const { disposeProcessDatabase } = await import(PROCESS_DATABASE_MODULE);
  await disposeProcessDatabase();
}
