import {
  buildCacheKey,
  Cache,
  deserializeCacheValue,
  normalizeCacheKeyPrefix,
  serializeCacheValue,
  type CacheCreateOptions,
  type CacheOptions,
} from "@shamt/cache";
import type { CloudflareKvCacheClient } from "@/types";

export interface CloudflareKvCacheOptions extends CacheOptions {
  client: CloudflareKvCacheClient;
}

export class CloudflareKvCache extends Cache {
  private readonly client: CloudflareKvCacheClient;
  private connected = false;

  constructor(options: CloudflareKvCacheOptions) {
    super({
      ...options,
      keyPrefix: normalizeCacheKeyPrefix(options.keyPrefix),
    });
    this.client = options.client;
  }

  override connect(): Promise<void> {
    this.connected = true;
    return Promise.resolve();
  }

  override async create<T = unknown>(
    key: string,
    value: T,
    options: CacheCreateOptions = {},
  ): Promise<void> {
    const ttl = this.resolveTtl(options.ttl);
    await this.client.put(
      this.getKey(key),
      serializeCacheValue(value),
      this.createPutOptions(ttl),
    );
  }

  override async read<T = unknown>(key: string): Promise<T | undefined> {
    return deserializeCacheValue<T>(
      (await this.client.get(this.getKey(key))) ?? undefined,
    );
  }

  override async delete(key: string): Promise<void> {
    await this.client.delete(this.getKey(key));
  }

  override async has(key: string): Promise<boolean> {
    return (await this.client.get(this.getKey(key))) !== null;
  }

  override async clear(): Promise<void> {
    let cursor: string | undefined;
    do {
      const result = await this.client.list({
        prefix: this.keyPrefix,
        cursor,
      });
      await Promise.all(
        result.keys.map((item) => this.client.delete(item.name)),
      );
      cursor = result.cursor;
      if (result.list_complete) break;
    } while (cursor);
  }

  override dispose(): Promise<void> {
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
