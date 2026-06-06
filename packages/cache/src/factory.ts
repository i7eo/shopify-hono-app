import { MemoryCache } from "./drivers/memory";
import type { Cache, CreateCacheOptions } from "./types";

/**
 * Create the default cache store for this package.
 */
export function createCache(options: CreateCacheOptions = {}): Cache {
  return new MemoryCache(options);
}
