import { getRuntimeCapability } from "@/app/runtime/capabilities";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Resolves the runtime-specific Shopify session storage adapter.
 */
export function getShopifySessionStorage(c: Context<AppEnv>) {
  const sessionStorageFactory = getRuntimeCapability(
    "shopifySessionStorageFactory",
  );

  if (sessionStorageFactory) {
    return sessionStorageFactory(c);
  }

  throw new Error("Shopify session storage is not configured for this runtime");
}
