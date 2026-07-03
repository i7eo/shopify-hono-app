import { DEFAULT_APP_DATABASE_PROVIDERS } from "@shamt/app-env";
import { runtimeNotSupported } from "@/utils/runtime";
import type { ShopifySessionStorage } from "./types";
import type { Database } from "@/infra/database";

type ShopifySessionStorageConstructor = new (
  db: unknown,
  table: unknown,
) => ShopifySessionStorage;

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
  assertSupportedDatabase(database);

  let storagePromise: Promise<ShopifySessionStorage> | undefined;
  const getStorage = () => {
    storagePromise ??= createProviderShopifySessionStorage(database);

    return storagePromise;
  };

  return {
    async storeSession(session) {
      return (await getStorage()).storeSession(session);
    },

    async loadSession(id) {
      return (await getStorage()).loadSession(id);
    },

    async deleteSession(id) {
      return (await getStorage()).deleteSession(id);
    },

    async deleteSessions(ids) {
      return (await getStorage()).deleteSessions(ids);
    },

    async findSessionsByShop(shop) {
      return (await getStorage()).findSessionsByShop(shop);
    },
  };
}

async function createProviderShopifySessionStorage(
  database: Database,
): Promise<ShopifySessionStorage> {
  if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES) {
    const [{ postgresShopifySessions }, adapterModule] = await Promise.all([
      import("@shamt/database/models/postgres"),
      import("@shopify/shopify-app-session-storage-drizzle/dist/esm/adapters/drizzle-postgres.adapter.mjs"),
    ]);
    const { DrizzleSessionStoragePostgres } = adapterModule as {
      DrizzleSessionStoragePostgres: ShopifySessionStorageConstructor;
    };

    return new DrizzleSessionStoragePostgres(
      database.db,
      postgresShopifySessions,
    );
  }

  if (database.provider === DEFAULT_APP_DATABASE_PROVIDERS.D1) {
    const [{ sqliteShopifySessions }, adapterModule] = await Promise.all([
      import("@shamt/database/models/sqlite"),
      import("@shopify/shopify-app-session-storage-drizzle/dist/esm/adapters/drizzle-sqlite.adapter.mjs"),
    ]);
    const { DrizzleSessionStorageSQLite } = adapterModule as {
      DrizzleSessionStorageSQLite: ShopifySessionStorageConstructor;
    };

    return new DrizzleSessionStorageSQLite(database.db, sqliteShopifySessions);
  }

  return assertUnsupportedDatabase(database);
}

function assertSupportedDatabase(
  database: Pick<Database, "provider" | "runtime">,
) {
  if (
    database.provider !== DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES &&
    database.provider !== DEFAULT_APP_DATABASE_PROVIDERS.D1
  ) {
    assertUnsupportedDatabase(database);
  }
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
