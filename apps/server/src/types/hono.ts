import type { Bindings } from "./cloudflare-kv";
import type { ShopifySessionTokenClaims } from "./shopify";
import type { RuntimeConfig } from "@/configs/runtime";
import type { Cache } from "@shamt/cache";
import type { Logger } from "@logtape/logtape";

export interface Variables {
  runtimeEnvConfig: RuntimeConfig;
  runtimeLogger: Logger;
  cache: Cache;

  // Set by verify-session-token middleware
  shopifySessionToken: ShopifySessionTokenClaims;
  shopDomain: string;
  shopifyUserId: string;

  // Set by token-exchange middleware
  shopifyAccessToken: string;

  // Set by verify-webhook middleware
  webhookTopic: string;
  webhookShop: string;
  webhookPayload: unknown;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
