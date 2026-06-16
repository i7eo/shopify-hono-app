import { isIsolateRuntime } from "@/utils";
import type { IsolateDatabase, IsolateDatabaseOptions } from "./isolate";
import type { ProcessDatabase } from "./process";
import type { RuntimeConfig } from "@/infra/env";

export * from "./shared";
export type { IsolateDatabase, IsolateDatabaseOptions } from "./isolate";
export type { ProcessDatabase } from "./process";

export type Database = ProcessDatabase | IsolateDatabase;

const ISOLATE_DATABASE_MODULE = "./isolate";
const PROCESS_DATABASE_MODULE = "./process";

/**
 * Creates the runtime-specific Drizzle database client.
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
