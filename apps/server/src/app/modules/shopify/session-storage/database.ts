import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { postgresShopifySessions } from "@shamt/database/models/postgres";
import { sqliteShopifySessions } from "@shamt/database/models/sqlite";
import {
  DrizzleSessionStoragePostgres,
  DrizzleSessionStorageSQLite,
} from "@shopify/shopify-app-session-storage-drizzle";
import { runtimeNotSupported } from "@/utils/runtime";
import type { ShopifySessionStorage } from "./types";
import type { Database } from "@/infra/database";

/**
 * Creates the Shopify session storage adapter from the unified runtime
 * database factory result.
 *
 * Example:
 * - postgres provider uses DrizzleSessionStoragePostgres.
 * - d1 provider uses DrizzleSessionStorageSQLite.
 */
export function createDatabaseShopifySessionStorage(
  database: Database,
): ShopifySessionStorage {
  if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES) {
    return new DrizzleSessionStoragePostgres(
      database.db,
      postgresShopifySessions,
    );
  }

  if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    return new DrizzleSessionStorageSQLite(database.db, sqliteShopifySessions);
  }

  return assertUnsupportedDatabase(database);
}

/**
 * Fails loudly when a new database provider reaches session storage without an
 * adapter implementation.
 */
function assertUnsupportedDatabase(
  database: Pick<Database, "provider" | "runtime">,
) {
  return runtimeNotSupported({
    mode: "throw",
    runtime: database.runtime,
    message: `Shopify session storage database provider is not supported: ${database.provider}`,
  });
}
