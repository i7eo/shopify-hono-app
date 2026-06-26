# Runtime Infra Entrypoints 决策

本文记录 `apps/server/src/infra/*/index.ts` 与 runtime capability 的拆分决策。它是架构 guide，不是接口 reference。

## 决策

`infra/*/index.ts` 只作为共享契约入口，不负责按 runtime 分发具体实现。

runtime-specific 实现由对应 runtime capability 显式引入：

| Runtime            | Capability 注册位置                                              |
| ------------------ | ---------------------------------------------------------------- |
| Node process       | `apps/server/src/app/runtime/process/capabilities.ts`            |
| Cloudflare isolate | `apps/server/src/app/runtime/isolate/cloudflare/capabilities.ts` |

公共 `infra/*/index.ts` 可以导出：

- shared types
- shared constants
- provider/env strategy parser
- registry API
- runtime-neutral helper

公共 `infra/*/index.ts` 不导出：

- `createXxx(config)` 这种内部再判断 runtime 的工厂
- `disposeXxx(config)` 这种内部再判断 runtime 的 disposer
- `await import("./process")`
- `await import("./isolate")`

## 原因

Cloudflare build 会静态分析入口可达的动态 import。即使业务代码运行时只会走 isolate 分支，只要 Cloudflare 入口间接 import 了一个公共 `infra/*/index.ts`，bundler 仍可能看到 `./process` 分支，并把 Node-only 模块纳入分析。

这会导致类似问题：

- `src/infra/bucket/process.ts` 被 Cloudflare build 分析。
- `node:fs`、`node:path`、`node:stream` 等 Node 内置模块出现 unresolved warning。
- 业务模块为了避开 warning 被迫知道 Node/Cloudflare 细节。

把 runtime 分发移动到 capability 注册处后，Cloudflare 入口只显式 import isolate 实现，Node 入口只显式 import process 实现。业务模块继续只依赖 capability，不直接依赖 runtime 实现。

## 当前边界

`infra/bucket/index.ts` 保留共享 bucket 契约和下载签名 helper：

```text
apps/server/src/infra/bucket/index.ts
apps/server/src/infra/bucket/shared.ts
apps/server/src/infra/bucket/r2-signed-url.ts
```

runtime 实现分别在：

```text
apps/server/src/infra/bucket/process.ts
apps/server/src/infra/bucket/isolate.ts
```

`infra/database/index.ts`、`infra/queue/index.ts`、`infra/scheduler/index.ts` 同理只保留共享导出和类型。具体创建与销毁逻辑放在：

```text
apps/server/src/app/runtime/process/capabilities.ts
apps/server/src/app/runtime/isolate/cloudflare/capabilities.ts
```

## Runtime Resource Context

`databaseFactory`、`bucketFactory`、`queueProducerFactory` 和 `moduleFileDownloadResolverFactory` 不再接收 Hono `Context`。

它们统一接收最小资源上下文：

```ts
type RuntimeResourceContext = {
  bindings?: Record<string, unknown>;
  runtimeEnv: RuntimeConfig;
};
```

HTTP route 通过 adapter 从 Hono context 转换：

```ts
createRuntimeResourceContextFromHono(c);
```

Queue 和 Scheduler context 本身已经携带 `runtimeEnv` 与可选 `bindings`，可以直接传给这些 factory。

这样 infra factory 不需要知道调用来自 HTTP、Queue 还是 Scheduler，也不会依赖 Hono。

> `RuntimeResourceContext` 与 `createRuntimeResourceContextFromHono` 现位于 `app/runtime/resources/context.ts`。这些 factory 产出的资源在一次请求/任务内如何复用与释放，见 [resource-scope.md](./resource-scope.md)。

## 新增 Infra 能力的规则

新增 `infra/foo` 时按以下规则放置代码：

| 内容                                      | 放置位置                                      |
| ----------------------------------------- | --------------------------------------------- |
| 共享接口、类型、strategy parser           | `infra/foo/index.ts` 或 `infra/foo/shared.ts` |
| Node-only 实现                            | `infra/foo/process.ts`                        |
| Cloudflare-only 实现                      | `infra/foo/isolate.ts`                        |
| runtime 选择、binding 校验、disposer 注册 | `app/runtime/*/capabilities.ts`               |
| 业务模块调用                              | `getRuntimeCapability("fooFactory")`          |

不要在业务 service、controller、queue job 中写：

```ts
if (isCloudflareRuntime(config)) {
  // create isolate infra
} else {
  // create process infra
}
```

这类 runtime 分支应该留在 capability 注册处。

## Binding 校验

Cloudflare binding 不在 module import 阶段校验。它们在 capability 使用点通过 env 中配置的 binding name 动态读取并强校验。

示例：

```ts
requireConfiguredCloudflareBinding(
  context.bindings ?? {},
  context.runtimeEnv.APP_BUCKET_R2_BINDING,
  "APP_BUCKET_R2_BINDING",
  isCloudflareR2Bucket,
);
```

这样 bootstrap 和 route metadata import 不会因为 request-bound binding 尚未出现而失败，但真正使用 D1、Hyperdrive、R2 或 Queue 时会快速失败。

## 检查项

修改 runtime infra 后至少检查：

```bash
rg "await import\\([\"']\\./(process|isolate)[\"']\\)" apps/server/src/infra
rg "backgroundBucketFactory|createDatabase\\(|createQueueProducer\\(|createScheduler\\(" apps/server/src
pnpm --dir apps/server run cf:build
pnpm --dir apps/server run node:build
```

`cf:build` 不应出现来自 `infra/*/process.ts` 的 Node 内置模块 unresolved warning。
