import { LRUCache as MemoryCacheStore } from "lru-cache";
import { DEFAULT_CACHE_MAX_SIZE } from "../constants";
import {
  Cache,
  normalizeCacheTtl,
  type CacheSetOptions,
  type MemoryCacheOptions,
} from "../types";
import {
  buildCacheKey,
  deserializeCacheValue,
  estimateCacheValueSize,
  normalizeCacheKeyPrefix,
  serializeCacheValue,
} from "../utils";

/**
 * In-memory cache store backed by lru-cache.
 *
 * Values are serialized at the cache boundary so the memory driver behaves
 * like remote stores such as Redis or KV.
 *
 * @example
 * const cache = new MemoryCache({ ttl: 60_000, keyPrefix: "shop" });
 * await cache.connect();
 * await cache.set("settings", { currency: "USD" });
 * const settings = await cache.get<{ currency: string }>("settings");
 * await cache.dispose();
 */
export class MemoryCache extends Cache<MemoryCacheStore<string, string>> {
  private connected = false;

  /**
   * Create a memory cache with optional TTL, key prefix, and max size.
   */
  constructor(options: MemoryCacheOptions = {}) {
    const ttl = normalizeCacheTtl(options.ttl);
    super(
      new MemoryCacheStore<string, string>({
        maxSize: options.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
        sizeCalculation: estimateCacheValueSize,
        ttl,
      }),
      {
        ...options,
        ttl,
        keyPrefix: normalizeCacheKeyPrefix(options.keyPrefix),
      },
    );
  }

  /**
   * Mark the memory store as connected.
   */
  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  /**
   * Store a value by key with an optional per-record TTL.
   */
  override set<T = unknown>(
    key: string,
    value: T,
    options: CacheSetOptions = {},
  ): Promise<void> {
    const ttl = this.resolveTtl(options.ttl);
    const cacheKey = this.getKey(key);
    const cacheValue = serializeCacheValue(value);
    if (ttl === undefined) {
      this.store.set(cacheKey, cacheValue);
      return Promise.resolve();
    }
    this.store.set(cacheKey, cacheValue, { ttl });
    return Promise.resolve();
  }

  /**
   * Read and deserialize a value by key.
   */
  override get<T = unknown>(key: string): Promise<T | undefined> {
    return Promise.resolve(
      deserializeCacheValue<T>(this.store.get(this.getKey(key))),
    );
  }

  /**
   * Delete a value by key.
   */
  override del(key: string): Promise<void> {
    this.store.delete(this.getKey(key));
    return Promise.resolve();
  }

  /**
   * Check whether a key exists in memory.
   */
  override has(key: string): Promise<boolean> {
    return Promise.resolve(this.store.has(this.getKey(key)));
  }

  /**
   * Remove every cached record.
   */
  clear(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }

  /**
   * Clear records and mark the store as disconnected.
   */
  dispose(): Promise<void> {
    this.connected = false;
    this.store.clear();
    return Promise.resolve();
  }

  /**
   * Whether connect has been called without a later dispose.
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Resolve a logical key into the stored key.
   */
  private getKey(key: string): string {
    return buildCacheKey(this.keyPrefix, key);
  }
}
