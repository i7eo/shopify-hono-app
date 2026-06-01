import { DEFAULT_CACHE_KEY_PREFIX, resolveCacheConfig } from "./config";
import { MemoryCacheAdapter } from "./drivers/memory";
import { CloudflareKvCacheAdapter } from "./drivers/platforms/cloudflare-kv";
import { RedisCacheAdapter } from "./drivers/redis";
import {
  CacheType,
  PlatformCacheType,
  type Cache,
  type CreateCacheOptions,
  type RedisCacheOptions,
} from "./types";

export function createCache(options: CreateCacheOptions = {}): Cache {
  const resolved = resolveCacheConfig({
    env: options.env,
    fallback: {
      ttl: options.ttl,
      keyPrefix: options.keyPrefix ?? DEFAULT_CACHE_KEY_PREFIX,
    },
    type: options.type,
    ttl: options.ttl,
    maxSizeKb: options.maxSizeKb,
  });

  if (resolved.type === CacheType.Redis) {
    return new RedisCacheAdapter({
      ttl: resolved.ttl,
      keyPrefix: resolved.keyPrefix,
      ...options.redis,
    } satisfies Required<Pick<RedisCacheOptions, "ttl" | "keyPrefix">> &
      RedisCacheOptions);
  }

  if (resolved.type === CacheType.Platform) {
    const platform = options.platform ?? {};
    const platformType = (platform.type ??
      options.platformType ??
      PlatformCacheType.Cloudflare) as PlatformCacheType | undefined;
    if (platformType !== PlatformCacheType.Cloudflare) {
      throw new Error(
        `Unsupported platform cache type: ${platformType ?? "undefined"}`,
      );
    }
    const cloudflare = platform.cloudflare;
    if (!cloudflare?.namespace) {
      throw new Error(
        `Cloudflare KV namespace is required for ${CacheType.Platform} cache`,
      );
    }
    const { namespace, ...cloudflareRest } = cloudflare;
    return new CloudflareKvCacheAdapter({
      ttl: resolved.ttl,
      keyPrefix: resolved.keyPrefix,
      namespace,
      ...cloudflareRest,
    });
  }

  return new MemoryCacheAdapter({
    ttl: resolved.ttl,
    keyPrefix: resolved.keyPrefix,
    maxSizeKb: resolved.maxSizeKb,
  });
}
