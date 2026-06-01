import { deserializeValue, serializeValue } from "@shamt/utils";
import Redis from "ioredis";
import {
  CacheType,
  type Cache,
  type CacheSetOptions,
  type RedisCacheOptions,
  type RedisClient,
} from "../types";
import { buildCacheKey } from "../utils";

export class RedisCacheAdapter implements Cache {
  private readonly client: Redis | RedisClient;
  private readonly ttl: number;
  private readonly keyPrefix: string;
  private connected = false;

  constructor(
    options: Required<Pick<RedisCacheOptions, "ttl" | "keyPrefix">> &
      RedisCacheOptions,
  ) {
    this.ttl = options.ttl;
    this.keyPrefix = options.keyPrefix;
    if (!options.client && !options.url) {
      throw new Error(
        `Redis url or client is required for ${CacheType.Redis} cache`,
      );
    }
    const { client, redisOptions, url } = options;
    if (client) {
      this.client = client;
      return;
    }

    this.client = redisOptions
      ? new Redis(url!, redisOptions)
      : new Redis(url!);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if ("status" in this.client && this.client.status === "ready") {
      this.connected = true;
      console.info("[cache] redis cache connected");
      return;
    }
    if ("connect" in this.client) {
      await this.client.connect();
    }
    this.connected = true;
    console.info("[cache] redis cache connected");
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return deserializeValue<T>(await this.client.get(this.getKey(key)));
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options: CacheSetOptions = {},
  ): Promise<void> {
    const ttl = options.ttl ?? this.ttl;
    await this.client.set(this.getKey(key), serializeValue(value), "PX", ttl);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.getKey(key));
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(this.getKey(key))) > 0;
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.keyPrefix}*`);
    if (keys.length === 0) return;
    await this.client.del(...keys);
  }

  async dispose(): Promise<void> {
    console.info("[cache] redis cache disconnected");
    if (this.client.quit) {
      await this.client.quit();
      return;
    }
    this.client.disconnect?.();
  }

  private getKey(key: string): string {
    return buildCacheKey(this.keyPrefix, key);
  }
}
