import { getRuntimeCapability } from "@/app/runtime/capabilities";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Resolves the Module Shopify session storage adapter for the active runtime.
 */
export function getShopifySessionStorage(c: Context<AppEnv>) {
  const sessionStorageFactory = getRuntimeCapability(
    "moduleShopifySessionStorageFactory",
  );

  if (sessionStorageFactory) {
    return sessionStorageFactory(c);
  }

  throw new Error("Shopify session storage is not configured for this runtime");
}
