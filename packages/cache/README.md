# @shamt/cache

<p><strong>English</strong> | <a href="./README.zh-CN.md">中文</a></p>

## Table of Contents

- [Overview](#overview)
- [Design and Architecture](#design-and-architecture)
- [Inputs and Outputs](#inputs-and-outputs)
- [Usage](#usage)
- [Implementation Notes](#implementation-notes)

## Overview

`@shamt/cache` defines the shared cache abstraction for the workspace and provides the default in-memory implementation. It is designed to stay runtime-neutral enough for shared packages, Node-like runtimes, and web-compatible runtimes.

The package currently includes:

- `Cache`: abstract cache contract.
- `MemoryCache`: LRU-based in-memory cache implementation.
- `createCache`: factory that creates the default `MemoryCache`.
- Utility functions for cache key normalization and value serialization.

Platform-specific stores such as Redis and Cloudflare KV should live in the application layer and extend the same `Cache` contract.

## Design and Architecture

`@shamt/cache` separates the cache contract from concrete runtime storage:

- The `Cache` base class stores the backing client in `this.store` and declares the core cache methods every implementation must provide: `set`, `get`, `del`, and `has`.
- Lifecycle methods such as `connect` and `dispose` are implementation-specific and are not part of the base `Cache` contract.
- Base methods throw `CacheMethodNotImplementedError` by default, so missing implementations fail early during development.
- TTL values passed into the package are always handled as milliseconds.
- Values are serialized at the cache boundary with JSON helpers from `@unimolecule/utils`, making the memory driver behave closer to string-based stores such as Redis and KV.
- Keys can be namespaced with a prefix. `MemoryCache` defaults to `cache:`;
  non-empty prefixes are normalized to end with `:`, and an empty prefix disables
  namespacing.

`MemoryCache` uses `lru-cache` for eviction, TTL, and max-size accounting. It is suitable for local development, tests, short-lived in-process caching, and runtime-neutral default behavior.

## Inputs and Outputs

Inputs:

- Logical cache keys as strings.
- JSON-serializable values.
- Per-write options, such as `{ ttl }`.
- Store-level options, such as `{ ttl, keyPrefix, maxSize }`.

Outputs:

- Write methods return `Promise<void>`.
- Read methods return `Promise<T | undefined>`.
- Existence checks return `Promise<boolean>`.
- Invalid TTL values, non-serializable values, or missing required methods throw errors.

Units:

- `ttl` is always in milliseconds.
- `maxSize` is always in bytes.
- `keyPrefix` defaults to `cache:` for `MemoryCache` and `createCache`.

## Usage

Use the default factory:

```ts
import { createCache } from "@shamt/cache";

const cache = createCache({
  ttl: 60_000,
  keyPrefix: "shop",
});

await cache.set("settings", { currency: "USD" });

const settings = await cache.get<{ currency: string }>("settings");
const exists = await cache.has("settings");

await cache.del("settings");
```

Use `MemoryCache` directly:

```ts
import { MemoryCache } from "@shamt/cache";

const cache = new MemoryCache({
  ttl: 5 * 60_000,
  keyPrefix: "session",
  maxSize: 1024 * 1024,
});

await cache.connect();
await cache.set("offline:shop.myshopify.com", {
  accessToken: "token",
});

const session = await cache.get<{ accessToken: string }>(
  "offline:shop.myshopify.com",
);

await cache.dispose();
```

Implement a platform-specific store:

```ts
import {
  Cache,
  deserializeCacheValue,
  serializeCacheValue,
  type CacheSetOptions,
} from "@shamt/cache";

interface RedisClient {
  set: (key: string, value: string, options?: { px: number }) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<void>;
  exists: (key: string) => Promise<number>;
  quit: () => Promise<void>;
}

class RedisCache extends Cache<RedisClient> {
  async connect() {
    // Open Redis connection.
  }

  override async set<T>(key: string, value: T, options: CacheSetOptions = {}) {
    const ttl = this.resolveTtl(options.ttl);
    await this.store.set(
      key,
      serializeCacheValue(value),
      ttl === undefined ? undefined : { px: ttl },
    );
  }

  override async get<T>(key: string): Promise<T | undefined> {
    return deserializeCacheValue<T>((await this.store.get(key)) ?? undefined);
  }

  override async del(key: string) {
    await this.store.del(key);
  }

  override async has(key: string) {
    return (await this.store.exists(key)) > 0;
  }

  async dispose() {
    await this.store.quit();
  }
}
```

## Implementation Notes

`@shamt/cache` currently only includes the memory driver. This avoids forcing Redis, Cloudflare KV, or other platform SDKs into the shared package dependency graph, keeping the package easier to reuse in node, web, and serverless/isolate environments.

Applications can choose runtime-specific stores at the application layer while still reusing the same `Cache` abstraction.
