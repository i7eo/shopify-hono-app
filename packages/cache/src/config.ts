import {
  ensureSuffix,
  isDef,
  isNumber,
  isString,
  trim,
  upperCase,
} from "@shamt/utils";
import {
  CacheType,
  PlatformCacheType,
  type BaseCacheOptions,
  type CacheEnv,
} from "./types";

export const DEFAULT_CACHE_TTL = 1000 * 60 * 5;
export const DEFAULT_CACHE_MAX_SIZE_KB = 1024 * 10;
export const DEFAULT_CACHE_KEY_PREFIX = "cache:";

export function parseCacheType(value?: string): CacheType | undefined {
  const normalized = normalizeEnvValue(value);
  if (isCacheType(normalized)) return normalized;
  return undefined;
}

export function parsePlatformType(
  value?: string,
): PlatformCacheType | undefined {
  const normalized = normalizeEnvValue(value);
  if (normalized === PlatformCacheType.Cloudflare) return normalized;
  return undefined;
}

export function toNumber(
  value: string | number | undefined,
): number | undefined {
  if (!isDef(value)) return undefined;
  const parsed = isNumber(value) ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolveCacheConfig(options: {
  env?: CacheEnv;
  fallback?: BaseCacheOptions;
  type?: CacheType;
  ttl?: number;
  maxSizeKb?: number;
}) {
  const env = options.env ?? {};
  const fallback = options.fallback ?? {};
  const ttl =
    options.ttl ?? toNumber(env.CACHE_TTL) ?? fallback.ttl ?? DEFAULT_CACHE_TTL;
  const maxSizeKb =
    options.maxSizeKb ??
    toNumber(env.CACHE_MAX_SIZE) ??
    (fallback as { maxSizeKb?: number }).maxSizeKb ??
    DEFAULT_CACHE_MAX_SIZE_KB;
  const type =
    options.type ?? parseCacheType(env.CACHE_TYPE) ?? CacheType.Memory;
  return {
    type,
    ttl,
    maxSizeKb,
    keyPrefix: ensureSuffix(
      ":",
      fallback.keyPrefix ?? DEFAULT_CACHE_KEY_PREFIX,
    ),
  };
}

function normalizeEnvValue(value?: string): string | undefined {
  if (!isString(value)) return undefined;
  return upperCase(trim(value));
}

function isCacheType(value: string | undefined): value is CacheType {
  return (
    value === CacheType.Memory ||
    value === CacheType.Redis ||
    value === CacheType.Platform
  );
}
