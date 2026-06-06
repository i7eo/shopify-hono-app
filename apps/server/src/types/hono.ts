import type { Bindings } from "./cloudflare-kv";
import type { ShopifySessionTokenClaims } from "./shopify";
import type { RuntimeConfig } from "@/infra/env";
import type { Logger } from "@/infra/logger";
import type { Cache } from "@shamt/cache";

export interface Variables {
  requestId: string;
  runtimeEnv: RuntimeConfig;
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
