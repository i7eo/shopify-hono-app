import {
  buildCacheKey,
  Cache,
  deserializeCacheValue,
  normalizeCacheKeyPrefix,
  serializeCacheValue,
  type CacheOptions,
  type CacheSetOptions,
} from "@shamt/cache";
import type { CloudflareKvCacheStore } from "@/types";

export interface CloudflareKvCacheOptions extends CacheOptions {
  store: CloudflareKvCacheStore;
}

export class CloudflareKvCache extends Cache<CloudflareKvCacheStore> {
  private connected = false;

  constructor(options: CloudflareKvCacheOptions) {
    super(options.store, {
      ...options,
      keyPrefix: normalizeCacheKeyPrefix(options.keyPrefix),
    });
  }

  connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  override async set<T = unknown>(
    key: string,
    value: T,
    options: CacheSetOptions = {},
  ): Promise<void> {
    const ttl = this.resolveTtl(options.ttl);
    await this.store.put(
      this.getKey(key),
      serializeCacheValue(value),
      this.createPutOptions(ttl),
    );
  }

  override async get<T = unknown>(key: string): Promise<T | undefined> {
    return deserializeCacheValue<T>(
      (await this.store.get(this.getKey(key))) ?? undefined,
    );
  }

  override async del(key: string): Promise<void> {
    await this.store.delete(this.getKey(key));
  }

  override async has(key: string): Promise<boolean> {
    return (await this.store.get(this.getKey(key))) !== null;
  }

  async clear(): Promise<void> {
    let cursor: string | undefined;
    do {
      const result = await this.store.list({
        prefix: this.keyPrefix,
        cursor,
      });
      await Promise.all(
        result.keys.map((item) => this.store.delete(item.name)),
      );
      cursor = result.cursor;
      if (result.list_complete) break;
    } while (cursor);
  }

  dispose(): Promise<void> {
    this.connected = false;
    return Promise.resolve();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private getKey(key: string): string {
    return buildCacheKey(this.keyPrefix, key);
  }

  private createPutOptions(ttl: number | undefined) {
    return {
      expirationTtl:
        ttl === undefined ? undefined : Math.max(Math.ceil(ttl / 1000)),
    };
  }
}
