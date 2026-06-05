import type { CacheOptions } from "@shamt/cache";
import type { DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";

export interface Bindings {
  APP_RUNTIME?: DEFAULT_RUNTIMES_VALUES;
  sofary: CloudflareKvCacheClient;
  SHOPIFY_APP_KEY: string;
  SHOPIFY_APP_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  SHOPIFY_API_VERSION: string;
}

export interface CloudflareKvCacheClient {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: {
      expirationTtl?: CacheOptions["ttl"];
    },
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (options?: { prefix?: string; cursor?: string }) => Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

// ---------------------------------------------------------------------------
// KV-stored session data
// ---------------------------------------------------------------------------

export interface StoredSession {
  shop: string;
  accessToken: string;
  scope: string;
  installedAt: string;
  /** ISO timestamp — present for online (token-exchange) tokens */
  expiresAt?: string;
  /** Shopify user ID — present for online tokens */
  userId?: string;
}
