import type { RuntimeConfig } from "@/infra/env";
import type { Logger } from "@/infra/logger";
import type { Cache } from "@shamt/cache";
import type { DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";
import type { JwtPayload, Session } from "@shopify/shopify-api";

export interface Bindings {
  APP_RUNTIME?: DEFAULT_RUNTIMES_VALUES;
  SHOPIFY_APP_KEY: string;
  SHOPIFY_APP_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  SHOPIFY_API_VERSION: string;
  sofary: Env["sofary"];
}

export interface Variables {
  requestId: string;
  runtimeEnv: RuntimeConfig;
  runtimeLogger: Logger;
  cache: Cache;

  // Set by verify-session-token middleware
  shopifySessionToken: JwtPayload;
  shopDomain: string;
  shopifyUserId: string;
  // Set by token-exchange middleware
  shopifySession: Session;
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
