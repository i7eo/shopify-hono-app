import { LRUCache } from "lru-cache";
import { DEFAULT_CACHE_MAX_SIZE } from "../constants";
import {
  Cache,
  type CacheCreateOptions,
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
 * await cache.create("settings", { currency: "USD" });
 * const settings = await cache.read<{ currency: string }>("settings");
 * await cache.dispose();
 */
export class MemoryCache extends Cache {
  private readonly records: LRUCache<string, string>;
  private connected = false;

  /**
   * Create a memory cache with optional TTL, key prefix, and max size.
   */
  constructor(options: MemoryCacheOptions = {}) {
    super({
      ...options,
      keyPrefix: normalizeCacheKeyPrefix(options.keyPrefix),
    });
    this.records = new LRUCache<string, string>({
      maxSize: options.maxSize ?? DEFAULT_CACHE_MAX_SIZE,
      sizeCalculation: estimateCacheValueSize,
      ttl: this.ttl,
    });
  }

  /**
   * Mark the memory store as connected.
   */
  override connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  /**
   * Store a value by key with an optional per-record TTL.
   */
  override create<T = unknown>(
    key: string,
    value: T,
    options: CacheCreateOptions = {},
  ): Promise<void> {
    const ttl = this.resolveTtl(options.ttl);
    const cacheKey = this.getKey(key);
    const cacheValue = serializeCacheValue(value);
    if (ttl === undefined) {
      this.records.set(cacheKey, cacheValue);
      return Promise.resolve();
    }
    this.records.set(cacheKey, cacheValue, { ttl });
    return Promise.resolve();
  }

  /**
   * Read and deserialize a value by key.
   */
  override read<T = unknown>(key: string): Promise<T | undefined> {
    return Promise.resolve(
      deserializeCacheValue<T>(this.records.get(this.getKey(key))),
    );
  }

  /**
   * Delete a value by key.
   */
  override delete(key: string): Promise<void> {
    this.records.delete(this.getKey(key));
    return Promise.resolve();
  }

  /**
   * Check whether a key exists in memory.
   */
  override has(key: string): Promise<boolean> {
    return Promise.resolve(this.records.has(this.getKey(key)));
  }

  /**
   * Remove every cached record.
   */
  override clear(): Promise<void> {
    this.records.clear();
    return Promise.resolve();
  }

  /**
   * Clear records and mark the store as disconnected.
   */
  override dispose(): Promise<void> {
    this.connected = false;
    this.records.clear();
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
