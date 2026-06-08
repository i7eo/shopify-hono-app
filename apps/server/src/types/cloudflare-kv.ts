import type { DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";

export interface Bindings {
  APP_RUNTIME?: DEFAULT_RUNTIMES_VALUES;
  sofary: CloudflareKvCacheStore;
  SHOPIFY_APP_KEY: string;
  SHOPIFY_APP_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  SHOPIFY_API_VERSION: string;
}

export type CloudflareKvCacheStore = KVNamespace;
