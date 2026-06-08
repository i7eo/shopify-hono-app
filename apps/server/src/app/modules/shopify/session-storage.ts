import { KVSessionStorage } from "@shopify/shopify-app-session-storage-kv";
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory";
import { isDev, isIsolateRuntime } from "@/utils";
import type { AppEnv } from "@/types";
import type { Context } from "hono";

const memorySessionStorage = new MemorySessionStorage();

export function getShopifySessionStorage(c: Context<AppEnv>) {
  const config = c.get("runtimeEnv");

  if (isIsolateRuntime(config.APP_RUNTIME)) {
    return new KVSessionStorage(c.env.sofary);
  }

  if (isDev(config.APP_ENV)) {
    return memorySessionStorage;
  }

  throw new Error(
    "Shopify memory session storage is only available when APP_RUNTIME=node and APP_ENV=development",
  );
}
