import { deserializeValue, serializeValue } from "@shamt/utils";
import { buildCacheKey } from "../../utils";
import type {
  Cache,
  CacheSetOptions,
  CloudflareKvCacheOptions,
  CloudflareKvClient,
} from "../../types";

const MIN_KV_TTL_SECONDS = 60;

export class CloudflareKvCacheAdapter implements Cache {
  private readonly client: CloudflareKvClient;
  private readonly ttl: number;
  private readonly keyPrefix: string;

  constructor(
    options: Required<Pick<CloudflareKvCacheOptions, "ttl" | "keyPrefix">> &
      CloudflareKvCacheOptions,
  ) {
    this.client = options.namespace;
    this.ttl = options.ttl;
    this.keyPrefix = options.keyPrefix;
  }

  connect(): Promise<void> {
    console.info("[cache] cloudflare kv cache connected");
    return Promise.resolve();
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return deserializeValue<T>(await this.client.get(this.getKey(key)));
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options: CacheSetOptions = {},
  ): Promise<void> {
    const ttl = Math.max(
      Math.ceil((options.ttl ?? this.ttl) / 1000),
      MIN_KV_TTL_SECONDS,
    );
    await this.client.put(this.getKey(key), serializeValue(value), {
      expirationTtl: ttl,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(this.getKey(key));
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async clear(): Promise<void> {
    let cursor: string | undefined;
    do {
      const result = await this.client.list({
        prefix: this.keyPrefix,
        cursor,
      });
      cursor = result.cursor;
      await Promise.all(
        result.keys.map((item) => this.client.delete(item.name)),
      );
      if (result.list_complete) break;
    } while (cursor);
  }

  dispose(): Promise<void> {
    console.info("[cache] cloudflare kv cache disconnected");
    return Promise.resolve();
  }

  private getKey(key: string): string {
    return buildCacheKey(this.keyPrefix, key);
  }
}
