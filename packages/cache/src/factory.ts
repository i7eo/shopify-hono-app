import { MemoryCache } from "./drivers/memory";
import type { Cache, CreateCacheOptions } from "./types";

export function createCache(options: CreateCacheOptions = {}): Cache {
  return new MemoryCache(options);
}
