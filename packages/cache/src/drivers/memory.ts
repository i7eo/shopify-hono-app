import { deserializeValue, serializeValue } from "@shamt/utils";
import { LRUCache } from "lru-cache";
import { buildCacheKey, estimateSize } from "../utils";
import type { Cache, CacheSetOptions, MemoryCacheOptions } from "../types";

export class MemoryCacheAdapter implements Cache {
  private readonly client: LRUCache<string, string>;
  private readonly ttl: number;
  private readonly keyPrefix: string;

  constructor(options: Required<MemoryCacheOptions>) {
    this.ttl = options.ttl;
    this.keyPrefix = options.keyPrefix;
    this.client = new LRUCache<string, string>({
      maxSize: options.maxSizeKb * 1024,
      ttl: options.ttl,
      sizeCalculation: estimateSize,
    });
  }

  connect(): Promise<void> {
    console.info("[cache] memory cache connected");
    return Promise.resolve();
  }

  get<T = unknown>(key: string): Promise<T | undefined> {
    return Promise.resolve(
      deserializeValue<T>(this.client.get(this.getKey(key)) ?? null),
    );
  }

  set<T = unknown>(
    key: string,
    value: T,
    options: CacheSetOptions = {},
  ): Promise<void> {
    this.client.set(this.getKey(key), serializeValue(value), {
      ttl: options.ttl ?? this.ttl,
    });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.client.delete(this.getKey(key));
    return Promise.resolve();
  }

  has(key: string): Promise<boolean> {
    return Promise.resolve(this.client.has(this.getKey(key)));
  }

  clear(): Promise<void> {
    this.client.clear();
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    console.info("[cache] memory cache disconnected");
    this.client.clear();
    return Promise.resolve();
  }

  private getKey(key: string): string {
    return buildCacheKey(this.keyPrefix, key);
  }
}
