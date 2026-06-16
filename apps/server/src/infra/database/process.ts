import { runtimeNotSupported } from "@/utils/runtime";
import {
  databaseSchema,
  getDatabaseEnvConfig,
  getDatabaseUrl,
  type DatabaseSchema,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type ProcessDatabase = NodePgDatabase<DatabaseSchema>;

let processDatabase: ProcessDatabase | undefined;

/**
 * Reuses the selected process database client across Node requests.
 */
export async function getProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  processDatabase ??= await createProcessDatabase(config);
  return processDatabase;
}

export async function createProcessDatabase(
  config: RuntimeConfig,
): Promise<ProcessDatabase> {
  const strategy = getDatabaseEnvConfig(config);

  if (strategy.provider === "d1") {
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

  return drizzle({ client: pool, schema: databaseSchema });
}
