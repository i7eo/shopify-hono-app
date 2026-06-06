/* eslint-disable unused-imports/no-unused-vars */

/**
 * Per-write cache options.
 */
export interface CacheCreateOptions {
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
export type CacheMethod =
  | "connect"
  | "create"
  | "read"
  | "delete"
  | "has"
  | "clear"
  | "dispose";

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
 * Base cache store contract.
 *
 * Concrete stores must override every public method. The base implementation
 * intentionally throws so missing methods fail loudly during development.
 */
export abstract class Cache {
  protected readonly ttl: number | undefined;
  protected readonly keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.ttl = normalizeCacheTtl(options.ttl);
    this.keyPrefix = options.keyPrefix ?? "";
  }

  /**
   * Open any required connection or mark the store as ready.
   */
  connect(): Promise<void> {
    throw this.createNotImplementedError("connect");
  }

  /**
   * Create or overwrite a cache record.
   */
  create<T = unknown>(
    _key: string,
    _value: T,
    _options?: CacheCreateOptions,
  ): Promise<void> {
    throw this.createNotImplementedError("create");
  }

  /**
   * Read a cache record by key.
   */
  read<T = unknown>(_key: string): Promise<T | undefined> {
    throw this.createNotImplementedError("read");
  }

  /**
   * Delete a cache record by key.
   */
  delete(_key: string): Promise<void> {
    throw this.createNotImplementedError("delete");
  }

  /**
   * Check whether a cache key exists.
   */
  has(_key: string): Promise<boolean> {
    throw this.createNotImplementedError("has");
  }

  /**
   * Remove all records from the store.
   */
  clear(): Promise<void> {
    throw this.createNotImplementedError("clear");
  }

  /**
   * Release resources held by the store.
   */
  dispose(): Promise<void> {
    throw this.createNotImplementedError("dispose");
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
