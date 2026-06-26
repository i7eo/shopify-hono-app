import { requireCapability } from "@/app/runtime/capabilities";
import { createRuntimeResourceContextFromHono } from "@/app/runtime/resources";
import { createDatabaseShopifySessionStorage } from "./database";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Resolves the Shopify session storage adapter from the unified database
 * capability. Session storage intentionally has no dedicated runtime
 * capability; it is an adapter over the request-scoped database.
 */
export async function getShopifySessionStorage(c: Context<AppEnv>) {
  const database = await c.get("resources").resolve(
    "database",
    () =>
      requireCapability("databaseFactory")(
        createRuntimeResourceContextFromHono(c),
      ),
    (db) => db.dispose(),
  );

  return createDatabaseShopifySessionStorage(database);
}
