import { createShopifyConfig } from "@/app/modules/shopify/config";
import { createShopifyClient } from "@/infra/http/shopify";
import { providerDisposers, providers } from "./constants";
import { getLoggerProvider } from "./logger";
import type { RuntimeConfig } from "@/infra/env";
import type { AppEnv } from "@/types";
import type { Shopify } from "@shopify/shopify-api";
import type { Context } from "hono";

export type ShopifyClient = Awaited<ReturnType<typeof createShopifyClient>>;

let shopifyConfigSignature: string | undefined;

export function getShopifyClientProvider(
  c: Context<AppEnv>,
): Promise<ShopifyClient> {
  return createShopifyClient(c);
}

export async function getShopifyConfigProvider(
  config: RuntimeConfig,
): Promise<Shopify> {
  const signature = getShopifyConfigSignature(config);
  const cached = providers.get("shopifyConfig") as Shopify | undefined;

  if (cached && shopifyConfigSignature === signature) {
    return cached;
  }

  const logger = await getLoggerProvider(config);
  const shopify = createShopifyConfig(config, logger);
  setShopifyConfigProvider(shopify, signature);

  return shopify;
}

export function resetShopifyProvider() {
  providers.delete("shopifyConfig");
  providerDisposers.delete("shopifyConfig");
  shopifyConfigSignature = undefined;
}

function setShopifyConfigProvider(shopify: Shopify, signature: string) {
  providers.set("shopifyConfig", shopify);
  shopifyConfigSignature = signature;
  providerDisposers.set("shopifyConfig", resetShopifyProvider);
}

function getShopifyConfigSignature(config: RuntimeConfig): string {
  return [
    config.APP_RUNTIME,
    config.APP_ENV,
    config.SHOPIFY_APP_KEY,
    config.SHOPIFY_APP_URL,
    config.SHOPIFY_API_VERSION,
    config.SCOPES,
  ]
    .map((value) => String(value ?? ""))
    .join(":");
}
