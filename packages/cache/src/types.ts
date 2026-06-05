export interface CacheCreateOptions {
  /** Default unit is 'ms' */
  ttl?: number;
  /** Default value is 'cache:' */
  keyPrefix?: string;
}

export interface CacheOptions {
  /** Default unit is 'ms' */
  ttl?: number;
  /** Default value is 'cache:' */
  keyPrefix?: string;
}

export interface MemoryCacheOptions extends CacheOptions {
  /** Default unit is 'b' */
  maxSize?: number
}

export type CacheMethod =
  | "connect"
  | "create"
  | "read"
  | "delete"
  | "has"
  | "clear"
  | "dispose";

export interface CreateCacheOptions extends MemoryCacheOptions {}

export class CacheMethodNotImplementedError extends Error {
  constructor(storeName: string, method: CacheMethod) {
    super(`${storeName} must implement Cache.${method}()`);
    this.name = "CacheMethodNotImplementedError";
  }
}

export abstract class Cache {
  protected readonly ttl: number | undefined;
  protected readonly keyPrefix: string;

  constructor(options: CacheOptions = {}) {
    this.ttl = normalizeCacheTtl(options.ttl);
    this.keyPrefix = options.keyPrefix ?? "";
  }

  connect(): Promise<void> {
    throw this.createNotImplementedError("connect");
  }

  create<T = unknown>(
    _key: string,
    _value: T,
    _options?: CacheCreateOptions,
  ): Promise<void> {
    throw this.createNotImplementedError("create");
  }

  read<T = unknown>(_key: string): Promise<T | undefined> {
    throw this.createNotImplementedError("read");
  }

  delete(_key: string): Promise<void> {
    throw this.createNotImplementedError("delete");
  }

  has(_key: string): Promise<boolean> {
    throw this.createNotImplementedError("has");
  }

  clear(): Promise<void> {
    throw this.createNotImplementedError("clear");
  }

  dispose(): Promise<void> {
    throw this.createNotImplementedError("dispose");
  }

  protected resolveTtl(ttl?: number): number | undefined {
    return normalizeCacheTtl(ttl ?? this.ttl);
  }

  private createNotImplementedError(
    method: CacheMethod,
  ): CacheMethodNotImplementedError {
    return new CacheMethodNotImplementedError(this.constructor.name, method);
  }
}

export function normalizeCacheTtl(ttl?: number): number | undefined {
  if (ttl === undefined) return undefined;
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new RangeError("Cache ttl must be a positive finite number in ms");
  }
  return ttl;
}
