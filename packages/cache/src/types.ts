import type Redis from "ioredis";

export enum CacheType {
  Memory = "MEMORY",
  Redis = "REDIS",
  Platform = "PLATFORM",
}

export enum PlatformCacheType {
  Cloudflare = "CLOUDFLARE",
}

export interface CacheSetOptions {
  ttl?: number;
}

export interface Cache {
  connect: () => Promise<void>;
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  set: <T = unknown>(
    key: string,
    value: T,
    options?: CacheSetOptions,
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
  has: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  dispose: () => Promise<void>;
}

export interface CacheEnv {
  CACHE_TYPE?: string;
  CACHE_MAX_SIZE?: string | number;
  CACHE_TTL?: string | number;
}

export interface BaseCacheOptions {
  ttl?: number;
  keyPrefix?: string;
}

export interface MemoryCacheOptions extends BaseCacheOptions {
  maxSizeKb?: number;
}

export interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    mode?: "PX",
    ttl?: number,
  ) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
  exists: (key: string) => Promise<number>;
  keys: (pattern: string) => Promise<string[]>;
  disconnect?: () => void;
  quit?: () => Promise<unknown>;
}

export interface RedisCacheOptions extends BaseCacheOptions {
  client?: RedisClient;
  url?: string;
  redisOptions?: Redis["options"];
}

export interface CloudflareKvClient {
  get: (key: string) => Promise<string | null>;
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (options?: { prefix?: string; cursor?: string }) => Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface CloudflareKvCacheOptions extends BaseCacheOptions {
  namespace: CloudflareKvClient;
}

export interface PlatformCacheOptions extends BaseCacheOptions {
  type?: PlatformCacheType;
  cloudflare?: CloudflareKvCacheOptions;
}

export interface CreateCacheOptions extends BaseCacheOptions {
  env?: CacheEnv;
  type?: CacheType;
  maxSizeKb?: number;
  platformType?: PlatformCacheType;
  redis?: RedisCacheOptions;
  platform?: PlatformCacheOptions;
}
