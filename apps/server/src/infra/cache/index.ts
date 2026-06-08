import { MemoryCache, type Cache } from "@shamt/cache";
import { isCloudflareRuntime } from "@/utils";
import { CloudflareKvCache } from "./cloudflare.kv";
import type { CloudflareRuntimeConfig, RuntimeConfig } from "@/infra/env";

type RuntimeCache = Cache & {
  dispose: () => Promise<void>;
};

let cache: RuntimeCache | undefined;
let cacheSignature: string | undefined;

export function getRuntimeCache(config: RuntimeConfig): RuntimeCache {
  const signature = getCacheSignature(config);
  if (!cache || cacheSignature !== signature) {
    cache?.dispose();
    cache = createRuntimeCache(config);
    cacheSignature = signature;
  }
  return cache;
}

export function createRuntimeCache(config: RuntimeConfig): RuntimeCache {
  if (isCloudflareRuntime(config.APP_RUNTIME)) {
    const cloudflareConfig = config as CloudflareRuntimeConfig;
    return new CloudflareKvCache({
      store: cloudflareConfig.sofary,
      ttl: config.APP_CACHE_EXPIRE,
      keyPrefix: "cache",
    });
  }

  return new MemoryCache({
    ttl: config.APP_CACHE_EXPIRE,
    maxSize: config.APP_CACHE_MAX_SIZE,
    keyPrefix: "cache",
  });
}

export async function closeRuntimeCache(): Promise<void> {
  if (!cache) return;
  await cache.dispose();
  cache = undefined;
  cacheSignature = undefined;
}

function getCacheSignature(config: RuntimeConfig): string {
  return [
    config.APP_RUNTIME,
    config.APP_CACHE_EXPIRE,
    config.APP_CACHE_MAX_SIZE,
  ].join(":");
}
