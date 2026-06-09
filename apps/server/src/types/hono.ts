import type { RuntimeConfig } from "@/infra/env";
import type { Logger } from "@/infra/logger";
import type { ShopifyClient } from "@/infra/provider";
import type { Cache } from "@shamt/cache";
import type { JwtPayload, Session } from "@shopify/shopify-api";

type RuntimeBindings<TRuntime extends RuntimeConfig["APP_RUNTIME"]> =
  TRuntime extends RuntimeConfig["APP_RUNTIME"]
    ? Partial<Extract<RuntimeConfig, { APP_RUNTIME: TRuntime }>> & {
        APP_RUNTIME?: TRuntime;
      }
    : never;

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
  // Set by shopify-admin middleware
  shopifyAdminClient: ShopifyClient;
  // Set by verify-webhook middleware
  webhookTopic: string;
  webhookShop: string;
  webhookPayload: unknown;
}

export type RuntimeAppEnv<
  TRuntime extends RuntimeConfig["APP_RUNTIME"] = RuntimeConfig["APP_RUNTIME"],
> = {
  /**
   * Bindings are derived from the runtime config union so env fields stay tied
   * to the Zod schemas. They remain partial because isolate bootstrap can read
   * process.env before request-bound platform bindings are available.
   */
  Bindings: RuntimeBindings<TRuntime>;
  Variables: Variables;
};

/**
 * Shared Hono env used by business modules. Runtime entries can narrow this
 * with RuntimeAppEnv<"cloudflare"> or RuntimeAppEnv<"node"> at the boundary.
 */
export type AppEnv = RuntimeAppEnv;
