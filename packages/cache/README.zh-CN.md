# @shamt/cache

<p><a href="./README.md">English</a> | <strong>中文</strong></p>

## 目录

- [介绍](#介绍)
- [设计与架构](#设计与架构)
- [输入与输出](#输入与输出)
- [使用方式](#使用方式)
- [实现说明](#实现说明)

## 介绍

`@shamt/cache` 定义 workspace 共享的 cache 抽象，并提供默认的内存实现。这个包希望保持足够 runtime-neutral，方便在共享包、Node-like runtime、以及 web-compatible runtime 中使用。

当前包内包含：

- `Cache`: 抽象 cache contract。
- `MemoryCache`: 基于 LRU 的内存 cache 实现。
- `createCache`: 创建默认 `MemoryCache` 的工厂函数。
- cache key 规范化、value 序列化等工具函数。

Redis、Cloudflare KV 等平台相关 store 不放在这个包内，应该由应用层自行实现并继承同一个 `Cache` contract。

## 设计与架构

`@shamt/cache` 将 cache contract 与具体运行时存储分离：

- `Cache` 基类把底层客户端保存在 `this.store`，并声明所有实现类必须具备的核心 cache 方法：`set`、`get`、`del`、`has`。
- `connect`、`dispose` 等生命周期方法属于具体实现自己的能力，不放在 `Cache` 基类 contract 中。
- 基类方法默认抛出 `CacheMethodNotImplementedError`，让未实现的方法在开发阶段尽早暴露。
- 包内传入的 TTL 均按毫秒处理。
- value 在 cache 边界统一使用 `@unimolecule/utils` 的 JSON helper 序列化，让 memory driver 的行为更接近 Redis、KV 这类字符串存储。
- key 可以使用 prefix 做命名空间隔离。`MemoryCache` 默认使用 `cache:`；非空 prefix 会被规范化为以 `:` 结尾，空字符串会关闭命名空间。

`MemoryCache` 使用 `lru-cache` 负责淘汰、TTL 与 max-size 统计。它适合本地开发、测试、短生命周期进程内缓存，以及 runtime-neutral 的默认行为。

## 输入与输出

输入：

- 字符串形式的逻辑 cache key。
- JSON-serializable value。
- 单次写入选项，例如 `{ ttl }`。
- store 级配置，例如 `{ ttl, keyPrefix, maxSize }`。

输出：

- 写操作返回 `Promise<void>`。
- 读取操作返回 `Promise<T | undefined>`。
- 存在性检查返回 `Promise<boolean>`。
- TTL 非法、value 无法序列化、实现类缺少必需方法时抛出错误。

单位：

- `ttl` 始终为毫秒。
- `maxSize` 始终为字节。
- `MemoryCache` 和 `createCache` 的 `keyPrefix` 默认是 `cache:`。

## 使用方式

使用默认工厂函数：

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

直接使用 `MemoryCache`：

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

实现平台相关 store：

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

## 实现说明

`@shamt/cache` 当前只内置 memory driver。这样可以避免把 Redis、Cloudflare KV 或其他平台 SDK 强行带入共享包依赖图，保证这个包在 node、web、serverless/isolate 等环境中更容易复用。

应用层可以根据部署 runtime 选择自己的 store，但仍然复用同一个 `Cache` 抽象。
