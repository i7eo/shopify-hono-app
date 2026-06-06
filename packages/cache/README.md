# @shamt/cache

<p><a href="./README.zh-CN.md">中文</a> | <strong>English</strong></p>

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

- The `Cache` base class declares the methods every implementation must provide: `connect`, `create`, `read`, `delete`, `has`, `clear`, and `dispose`.
- Base methods throw `CacheMethodNotImplementedError` by default, so missing implementations fail early during development.
- TTL values passed into the package are always handled as milliseconds.
- Values are serialized at the cache boundary with JSON helpers from `@shamt/utils`, making the memory driver behave closer to string-based stores such as Redis and KV.
- Keys can be namespaced with a prefix. Non-empty prefixes are normalized to end with `:`.

`MemoryCache` uses `lru-cache` for eviction, TTL, and max-size accounting. It is suitable for local development, tests, short-lived in-process caching, and runtime-neutral default behavior.

## Inputs and Outputs

Inputs:

- Logical cache keys as strings.
- JSON-serializable values.
- Per-write options, such as `{ ttl }`.
- Store-level options, such as `{ ttl, keyPrefix, maxSize }`.

Outputs:

- Lifecycle and write methods return `Promise<void>`.
- Read methods return `Promise<T | undefined>`.
- Existence checks return `Promise<boolean>`.
- Invalid TTL values, non-serializable values, or missing required methods throw errors.

Units:

- `ttl` is always in milliseconds.
- `maxSize` is always in bytes.

## Usage

Use the default factory:

```ts
import { createCache } from "@shamt/cache";

const cache = createCache({
  ttl: 60_000,
  keyPrefix: "shop",
});

await cache.connect();
await cache.create("settings", { currency: "USD" });

const settings = await cache.read<{ currency: string }>("settings");
const exists = await cache.has("settings");

await cache.delete("settings");
await cache.dispose();
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
await cache.create("offline:shop.myshopify.com", {
  accessToken: "token",
});

const session = await cache.read<{ accessToken: string }>(
  "offline:shop.myshopify.com",
);
```

Implement a platform-specific store:

```ts
import { Cache, type CacheCreateOptions } from "@shamt/cache";

class RedisCache extends Cache {
  override async connect() {
    // Open Redis connection.
  }

  override async create<T>(
    key: string,
    value: T,
    options: CacheCreateOptions = {},
  ) {
    const ttl = this.resolveTtl(options.ttl);
    // Serialize value and write to Redis with ttl in milliseconds.
  }

  override async read<T>(key: string): Promise<T | undefined> {
    // Read and deserialize from Redis.
    return undefined;
  }

  override async delete(key: string) {}
  override async has(key: string) {
    return false;
  }
  override async clear() {}
  override async dispose() {}
}
```

## Implementation Notes

`@shamt/cache` currently only includes the memory driver. This avoids forcing Redis, Cloudflare KV, or other platform SDKs into the shared package dependency graph, keeping the package easier to reuse in node, web, and serverless/isolate environments.

Applications can choose runtime-specific stores at the application layer while still reusing the same `Cache` abstraction.
