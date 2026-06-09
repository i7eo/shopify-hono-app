/* eslint-disable unused-imports/no-unused-vars */

/**
 * Per-write cache options.
 */
export interface CacheSetOptions {
  /** Default unit is 'ms' */
  ttl?: number;
  /** Default value is 'cache:' */
  keyPrefix?: string;
}

/**
 * Shared cache store options.
 */
export interface CacheOptions {
  /** Default unit is 'ms' */
  ttl?: number;
  /** Default value is 'cache:' */
  keyPrefix?: string;
}

/**
 * Options used by the in-memory LRU cache implementation.
 */
export interface MemoryCacheOptions extends CacheOptions {
  /** Default unit is 'b' */
  maxSize?: number;
}

/**
 * Methods every cache store must implement.
 */
export type CacheMethod = "set" | "get" | "del" | "has";

/**
 * Options accepted by the default cache factory.
 */
export interface CreateCacheOptions extends MemoryCacheOptions {}

/**
 * Error thrown when a cache implementation does not override a required method.
 */
export class CacheMethodNotImplementedError extends Error {
  constructor(storeName: string, method: CacheMethod) {
    super(`${storeName} must implement Cache.${method}()`);
    this.name = "CacheMethodNotImplementedError";
  }
}

/**
 * Base cache contract.
 *
 * Concrete implementations keep their backing client in `store` and override
 * the core cache operations. Lifecycle methods such as connect/dispose are
 * implementation-specific and are intentionally not part of this contract.
 */
export abstract class Cache<TStore = unknown> {
  protected readonly store: TStore;
  protected readonly ttl: number | undefined;
  protected readonly keyPrefix: string;

  constructor(store: TStore, options: CacheOptions = {}) {
    this.store = store;
    this.ttl = normalizeCacheTtl(options.ttl);
    this.keyPrefix = options.keyPrefix ?? "";
  }

  /**
   * Create or overwrite a cache record.
   */
  set<T = unknown>(
    _key: string,
    _value: T,
    _options?: CacheSetOptions,
  ): Promise<void> {
    throw this.createNotImplementedError("set");
  }

  /**
   * Read a cache record by key.
   */
  get<T = unknown>(_key: string): Promise<T | undefined> {
    throw this.createNotImplementedError("get");
  }

  /**
   * Delete a cache record by key.
   */
  del(_key: string): Promise<void> {
    throw this.createNotImplementedError("del");
  }

  /**
   * Check whether a cache key exists.
   */
  has(_key: string): Promise<boolean> {
    throw this.createNotImplementedError("has");
  }

  /**
   * Resolve a write TTL against the store default.
   */
  protected resolveTtl(ttl?: number): number | undefined {
    return normalizeCacheTtl(ttl ?? this.ttl);
  }

  /**
   * Create the standard missing-method error for this cache implementation.
   */
  private createNotImplementedError(
    method: CacheMethod,
  ): CacheMethodNotImplementedError {
    return new CacheMethodNotImplementedError(this.constructor.name, method);
  }
}

/**
 * Validate and normalize a TTL value in milliseconds.
 */
export function normalizeCacheTtl(ttl?: number): number | undefined {
  if (ttl === undefined) return undefined;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new RangeError("Cache ttl must be a positive finite number in ms");
  }
  return ttl;
}
