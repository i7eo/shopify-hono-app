import { LRUCache } from "lru-cache";
import {
  DEFAULT_MEMORY_CACHE_MAX_SIZE_KB,
} from "../constants";
import { Cache } from "../types";
import {
  buildCacheKey,
  deserializeCacheValue,
  estimateCacheValueSize,
  serializeCacheValue,
  normalizeCacheKeyPrefix
} from "../utils";
import type { CacheCreateOptions, MemoryCacheOptions } from "../types";

export class MemoryCache extends Cache {
  private readonly records: LRUCache<string, string>;
  private connected = false;

  constructor(options: MemoryCacheOptions = {}) {
    super({
      ...options,
      keyPrefix: normalizeCacheKeyPrefix(options.keyPrefix),
    });
    this.records = new LRUCache<string, string>({
      maxSize: (options.maxSize ?? DEFAULT_MEMORY_CACHE_MAX_SIZE_KB),
      sizeCalculation: estimateCacheValueSize,
      ttl: this.ttl,
    });
  }

  override connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

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

  override read<T = unknown>(key: string): Promise<T | undefined> {
    return Promise.resolve(
      deserializeCacheValue<T>(this.records.get(this.getKey(key))),
    );
  }

  override delete(key: string): Promise<void> {
    this.records.delete(this.getKey(key));
    return Promise.resolve();
  }

  override has(key: string): Promise<boolean> {
    return Promise.resolve(this.records.has(this.getKey(key)));
  }

  override clear(): Promise<void> {
    this.records.clear();
    return Promise.resolve();
  }

  override dispose(): Promise<void> {
    this.connected = false;
    this.records.clear();
    return Promise.resolve();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private getKey(key: string): string {
    return buildCacheKey(this.keyPrefix, key);
  }
}
