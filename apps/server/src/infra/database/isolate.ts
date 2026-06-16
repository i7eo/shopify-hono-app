import { internalServerError } from "@/shared/exceptions";
import { runtimeNotSupported } from "@/utils/runtime";
import {
  databaseSchema,
  getDatabaseEnvConfig,
  type DatabaseSchema,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type IsolateDatabase = NodePgDatabase<DatabaseSchema>;
export type IsolateDatabaseOptions = {
  d1?: D1Database;
  hyperdrive?: Hyperdrive;
};

/**
 * Creates an isolate-safe Drizzle database client.
 */
export async function createIsolateDatabase(
  config: RuntimeConfig,
  options: IsolateDatabaseOptions = {},
): Promise<IsolateDatabase> {
  const strategy = getDatabaseEnvConfig(config);

  if (strategy.provider === "d1") {
    return runtimeNotSupported({
      mode: "throw",
      runtime: config.APP_RUNTIME,
      message: "D1 database is reserved but not implemented yet",
    });
  }

  const hyperdrive = requireHyperdrive(options.hyperdrive);
  const [{ drizzle }, { Client }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
  ]);
  const client = new Client({
    connectionString: hyperdrive.connectionString,
  });

  await client.connect();
  return drizzle({ client, schema: databaseSchema });
}

function requireHyperdrive(value: Hyperdrive | undefined): Hyperdrive {
  if (!value) {
    throw internalServerError("Cloudflare Hyperdrive binding is required", {
      expose: true,
    });
  }

  return value;
}
