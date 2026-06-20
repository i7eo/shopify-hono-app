import { getRuntimeCapability } from "@/app/runtime/capabilities";
import { createRuntimeResourceContextFromHono } from "@/app/runtime/resource-context";
import { internalServerError } from "@/shared/exceptions";
import { createDatabaseShopifySessionStorage } from "./database";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Resolves the Shopify session storage adapter from the unified database
 * capability. Session storage intentionally has no dedicated runtime
 * capability; it is an adapter over the shared databaseFactory.
 */
export async function getShopifySessionStorage(c: Context<AppEnv>) {
  const databaseFactory = getRuntimeCapability("databaseFactory");

  if (!databaseFactory) {
    throw internalServerError(
      "Runtime capability is not registered: databaseFactory",
      {
        expose: true,
      },
    );
  }

  return createDatabaseShopifySessionStorage(
    await databaseFactory(createRuntimeResourceContextFromHono(c)),
  );
}
