import { deserializeValue, serializeValue } from "@unimolecule/utils";
import { DEFAULT_CACHE_KEY_PREFIX } from "./constants";

/**
 * Join a cache key prefix and logical key.
 */
export function buildCacheKey(prefix: string, key: string): string {
  return prefix ? `${prefix}${key}` : key;
}

/**
 * Serialize a cache value at the store boundary.
 */
export function serializeCacheValue<T>(value: T): string {
  const serialized = serializeValue(value) as string | undefined;
  if (serialized === undefined) {
    throw new TypeError("Cache value must be JSON serializable");
  }
  return serialized;
}

/**
 * Deserialize a cache value at the store boundary.
 */
export function deserializeCacheValue<T = unknown>(
  value: string | undefined,
): T | undefined {
  if (value === undefined) return undefined;
  return deserializeValue<T>(value);
}

/**
 * Estimate the stored value size for LRU size accounting.
 */
export function estimateCacheValueSize(value: string): number {
  return value.length;
}

/**
 * Normalize a cache key prefix and ensure non-empty prefixes end with ':'.
 */
export function normalizeCacheKeyPrefix(
  keyPrefix = DEFAULT_CACHE_KEY_PREFIX,
): string {
  if (!keyPrefix) return "";
  return keyPrefix.endsWith(":") ? keyPrefix : `${keyPrefix}:`;
}
