# @shamt/cache

<p><strong>中文</strong> | <a href="./README.md">English</a></p>

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

- `Cache` 基类声明所有实现类必须具备的方法：`connect`、`create`、`read`、`delete`、`has`、`clear`、`dispose`。
- 基类方法默认抛出 `CacheMethodNotImplementedError`，让未实现的方法在开发阶段尽早暴露。
- 包内传入的 TTL 均按毫秒处理。
- value 在 cache 边界统一使用 `@shamt/utils` 的 JSON helper 序列化，让 memory driver 的行为更接近 Redis、KV 这类字符串存储。
- key 可以使用 prefix 做命名空间隔离，非空 prefix 会被规范化为以 `:` 结尾。

`MemoryCache` 使用 `lru-cache` 负责淘汰、TTL 与 max-size 统计。它适合本地开发、测试、短生命周期进程内缓存，以及 runtime-neutral 的默认行为。

## 输入与输出

输入：

- 字符串形式的逻辑 cache key。
- JSON-serializable value。
- 单次写入选项，例如 `{ ttl }`。
- store 级配置，例如 `{ ttl, keyPrefix, maxSize }`。

输出：

- 生命周期与写操作返回 `Promise<void>`。
- 读取操作返回 `Promise<T | undefined>`。
- 存在性检查返回 `Promise<boolean>`。
- TTL 非法、value 无法序列化、实现类缺少必需方法时抛出错误。

单位：

- `ttl` 始终为毫秒。
- `maxSize` 始终为字节。

## 使用方式

使用默认工厂函数：

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

直接使用 `MemoryCache`：

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

实现平台相关 store：

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

## 实现说明

`@shamt/cache` 当前只内置 memory driver。这样可以避免把 Redis、Cloudflare KV 或其他平台 SDK 强行带入共享包依赖图，保证这个包在 node、web、serverless/isolate 等环境中更容易复用。

应用层可以根据部署 runtime 选择自己的 store，但仍然复用同一个 `Cache` 抽象。
