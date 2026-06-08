import { getRuntimeCapability } from "@/app/runtime/capabilities";
import type { AppEnv } from "@/types";
import type { Context } from "hono";

export function getShopifySessionStorage(c: Context<AppEnv>) {
  const sessionStorageFactory = getRuntimeCapability(
    "shopifySessionStorageFactory",
  );

  if (sessionStorageFactory) {
    return sessionStorageFactory(c);
  }

  throw new Error("Shopify session storage is not configured for this runtime");
}
