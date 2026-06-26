import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { internalServerError } from "@/shared/exceptions";
import {
  getDatabaseEnvConfig,
  postgresDatabaseSchema,
  sqliteDatabaseSchema,
  type PostgresDatabaseSchema,
  type SqliteDatabaseSchema,
} from "./shared";
import type { RuntimeConfig } from "@/infra/env";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type IsolatePostgresDatabase = {
  db: NodePgDatabase<PostgresDatabaseSchema>;
  dialect: "postgres";
  dispose: () => Promise<void>;
  provider: typeof DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES;
  runtime: RuntimeConfig["APP_RUNTIME"];
};
export type IsolateD1Database = {
  db: DrizzleD1Database<SqliteDatabaseSchema>;
  dialect: "sqlite";
  dispose: () => Promise<void>;
  provider: typeof DEFAULT_APP_DATABASE_PROVIDERS.D1;
  runtime: RuntimeConfig["APP_RUNTIME"];
};
export type IsolateDatabase = IsolatePostgresDatabase | IsolateD1Database;
export type IsolateDatabaseOptions = {
  d1?: D1Database;
  hyperdrive?: Hyperdrive;
};

/**
 * Creates an isolate-safe Drizzle database client from request-bound bindings.
 *
 * Example:
 * - APP_DATABASE_PROVIDER=d1 uses the Cloudflare D1 binding.
 * - APP_DATABASE_PROVIDER=postgres uses the Cloudflare Hyperdrive binding.
 */
export async function createIsolateDatabase(
  config: RuntimeConfig,
  options: IsolateDatabaseOptions = {},
): Promise<IsolateDatabase> {
  const strategy = getDatabaseEnvConfig(config);

  if (strategy.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    const { drizzle } = await import("drizzle-orm/d1");
    return {
      db: drizzle(requireD1(options.d1), { schema: sqliteDatabaseSchema }),
      dialect: "sqlite",
      // D1 bindings are request-bound and own no closable socket.
      dispose: () => Promise.resolve(),
      provider: DEFAULT_APP_DATABASE_PROVIDERS.D1,
      runtime: config.APP_RUNTIME,
    };
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
  return {
    db: drizzle({ client, schema: postgresDatabaseSchema }),
    dialect: "postgres",
    // Each isolate request opens its own pg socket; close it when the
    // owning request/job scope disposes to avoid exhausting Hyperdrive slots.
    dispose: () => client.end(),
    provider: DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES,
    runtime: config.APP_RUNTIME,
  };
}

/**
 * Capability-level disposer for isolate database infrastructure.
 *
 * No-op by design: isolate clients are request-bound and now closed per
 * request/job by the resource scope (see app/runtime/resources/scope.ts).
 * Kept for symmetry with the capability disposer wiring at app teardown.
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

/**
 * Requires the Hyperdrive binding at the database capability boundary.
 */
function requireHyperdrive(value: Hyperdrive | undefined): Hyperdrive {
  if (!value) {
    throw internalServerError("Cloudflare Hyperdrive binding is required", {
      expose: true,
    });
  }

  return value;
}
