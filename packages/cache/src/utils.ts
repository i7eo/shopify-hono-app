import { DEFAULT_CACHE_KEY_PREFIX } from "./constants";

export function buildCacheKey(prefix: string, key: string): string {
  return prefix ? `${prefix}${key}` : key;
}

export function serializeCacheValue<T>(value: T): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Cache value must be JSON serializable");
  }
  return serialized;
}

export function deserializeCacheValue<T = unknown>(
  value: string | undefined,
): T | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function estimateCacheValueSize(value: string): number {
  return value.length;
}

export function normalizeCacheKeyPrefix(
  keyPrefix = DEFAULT_CACHE_KEY_PREFIX,
): string {
  if (!keyPrefix) return "";
  return keyPrefix.endsWith(":") ? keyPrefix : `${keyPrefix}:`;
}
