# Technique Notes

本文总结 `apps/server` 中值得复用的架构小技巧。它不是设计草案，而是当前代码已经落地的工程约定。

## 分层 DI

项目没有引入大型 DI container，而是用几组小型 registry 完成依赖注入。

### Runtime Capability

runtime capability 负责注入平台相关能力：

- `runtimeLoggerSetup`
- `runtimeEnvSourceResolver`
- `moduleHealthProcessDiskChecker`
- `databaseFactory`
- `bucketFactory`
- `moduleFileDownloadResolverFactory`
- `moduleFileTaskDispatcherFactory`

共享业务代码只调用 capability，不静态 import Node-only 或 Cloudflare-only 实现。文件模块与 Shopify session storage 都通过统一的 `databaseFactory` 获取 Drizzle client，各模块再在自己的业务边界内实现 store/adapter。
file module 通过 `bucketFactory` 获取 object bucket，并通过 `moduleFileDownloadResolverFactory` 把下载解析为 memory stream 或 R2 signed redirect。

对应文件：

- `src/app/runtime/capabilities.ts`
- `src/app/runtime/process/capabilities.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`

这个技巧的价值是把平台差异限制在 runtime entry 附近。新增 runtime 时，优先补 capability，而不是改业务 controller。

### Provider Registry

provider registry 缓存跨请求可复用的基础设施实例：

- env provider
- logger provider
- HTTP client provider
- Shopify SDK config provider

对应文件：

- `src/infra/provider/constants.ts`
- `src/infra/provider/env.ts`
- `src/infra/provider/logger.ts`
- `src/infra/provider/shopify.ts`
- `src/infra/provider/client.ts`

每个 provider 都有 reset/disposer 入口，测试和 lifecycle 可以清理全局状态，避免 provider cache 污染下一轮运行。

database 与 bucket 没有放入 provider registry，而是作为 runtime capability 暴露。原因是它们的 runtime/provider 支持矩阵依赖平台能力：Node 需要进程级 pg pool 和 memory/r2 bucket cache，Cloudflare 需要 request-bound D1/Hyperdrive binding。capability disposer 会在 process runtime 释放 cached pg pool 和 bucket adapter，isolate runtime 当前保持 no-op。

### Shopify Mode Capability

Shopify app mode 不走 runtime capability，而是单独维护 mode capability：

- `embedded`
- `standalone`

它只处理 Shopify app-flow 差异，例如 App Shell、OAuth callback redirect、Admin request session strategy。

对应文件：

- `src/app/modules/shopify/mode/capabilities.ts`
- `src/app/modules/shopify/mode/embedded.ts`
- `src/app/modules/shopify/mode/standalone.ts`

runtime、Shopify mode 和 frontend target 保持正交，具体 env 语义见 [env.md](./env.md#shopify-相关-env)。

## Runtime Env 合并

env provider 支持两个阶段：

1. bootstrap 阶段读取 `process.env` 中的字符串配置。
2. request 阶段通过 `runtimeEnvMiddleware` 合并 runtime capability 提供的 env source。

Cloudflare 下 env source 来自 `c.env`，Node 下来自 `process.env`：

```ts
const envConfig = runtimeEnvSourceResolver?.(c) ?? c.env ?? getSafeProcessEnv();
const runtimeEnv = getEnvProvider(envConfig);
```

`getEnvProvider(rawEnv)` 默认会把 `process.env` 与传入 env merge：

```ts
const effectiveRawEnv = options.override
  ? nextRawEnv
  : { ...getSafeProcessEnv(), ...nextRawEnv };
```

这个设计让模块 import 阶段可以读取 bootstrap env，也让请求进来后可以用平台 binding 刷新为更完整的 runtime env。

## Bootstrap 边界

`bootstrapApp()` 永远 runtime-agnostic。它只组装通用 Hono app，不接收 runtime 参数，也不注册平台实现。

runtime-specific 行为只放在两个地方：

- runtime entry，例如 `src/app/runtime/process/index.ts`。
- runtime capability，例如 `src/app/runtime/isolate/cloudflare/capabilities.ts`。

业务模块只使用通用 `AppEnv`。平台 binding 在 schema 中可以 optional，但必须在 capability 使用点通过 `requireCloudflareBinding(...)` 之类的 helper 强校验。

## Binding Optional + 使用点强校验

Cloudflare platform binding 在 schema 中允许 optional，例如 `i7eo_dev_shopify_app_d1?: D1Database`。原因是 Worker 模块 import 阶段可能只拿到 `process.env` 中的字符串配置，还没进入 request-bound `c.env`。

真正需要 binding 的地方必须强校验：

```ts
const d1 = requireCloudflareBinding(
  context.env.i7eo_dev_shopify_app_d1,
  "i7eo_dev_shopify_app_d1",
  isCloudflareD1Database,
);
```

对应文件：

- `src/infra/env/isolate.ts`
- `src/app/runtime/isolate/cloudflare/bindings.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`

这条规则可以概括为：启动阶段宽，能力使用严。

## AppEnv 从 Schema 推导

Hono `Bindings` 不手写重复字段，而是从 `RuntimeConfig` union 推导：

```ts
type RuntimeBindings<TRuntime extends RuntimeConfig["APP_RUNTIME"]> = Partial<
  Extract<RuntimeConfig, { APP_RUNTIME: TRuntime }>
>;
```

业务模块使用通用 `AppEnv`，runtime entry 可以用 `RuntimeAppEnv<"cloudflare">` 等具体类型收窄。

对应文件：

- `src/types/hono.ts`
- `src/app/runtime/isolate/cloudflare/index.ts`

这能减少新增 env 时的重复维护面。通常只需要改 schema 和必要的 binding 类型，不需要在每个业务模块重复声明字段。

## Logger Reset

logger provider 区分 bootstrap 与 runtime 阶段：

- 没有 runtime config 时初始化 bootstrap logger。
- 有 runtime config 时按 runtime/env/log 配置签名决定是否 reset。
- provider disposer 会调用 LogTape `dispose()` 并清理 provider cache。

对应文件：

- `src/infra/provider/logger.ts`
- `src/infra/logger/index.ts`
- `src/infra/logger/shared.ts`

这个技巧避免每个请求重复配置 logger，也避免测试或 runtime 切换后继续持有旧 logger sink。

## Import Graph 隔离

Cloudflare entry 不能静态引入 Node-only 依赖。项目通过几个规则保护 import graph：

- Node-only 实现放在 process entry、process capability 或 process logger 中。
- 文件日志依赖用动态 import。
- Cloudflare 共享代码不从 process util barrel 导入 Node-only 模块。
- runtime capability 只暴露抽象函数。

典型文件：

- `src/app/runtime/process/utils/disk.ts`
- `src/app/runtime/process/utils/net.ts`
- `src/infra/logger/process.ts`
- `src/app/runtime/isolate/cloudflare/index.ts`

## Retryable Shopify Admin Client

Shopify Admin GraphQL client 被 proxy 包装。`request` 遇到 Shopify `401` 时：

1. 根据当前 Shopify mode 刷新 session。
2. 更新 Hono context 中的 session。
3. 重新创建 Admin client。
4. 使用原参数重试一次。

对应文件：

- `src/app/modules/shopify/admin/client.ts`
- `src/app/modules/shopify/admin/middleware.ts`

controller 不需要关心 token 过期，只消费 `c.var.shopifyAdminClient`。

## 统一错误出口

业务代码抛 `AppError` 或错误工厂，Hono lifecycle 统一 normalize 和响应：

- `AppError`
- `HTTPException`
- `ZodError`
- upstream request error
- unknown thrown value

对应文件：

- `src/shared/exceptions/normalize.ts`
- `src/shared/exceptions/errors.ts`
- `src/app/lifecycle/error.ts`

这样 controller 不手写错误 JSON，错误暴露策略集中维护。

## 条件 OpenAPI

`createApp()` 不默认注册 OpenAPI。OpenAPI 由 bootstrap option 控制：

- Node non-production 注册 `/document` 与 `/reference`。
- Cloudflare isolate 默认不注册。
- production 默认不注册。

对应文件：

- `src/app/bootstrap/create-app.ts`
- `src/app/bootstrap/index.ts`
- `src/app/bootstrap/register-openapi.ts`

这个技巧能避免 Cloudflare bundle 和 production runtime 加载不必要的文档依赖。

## 测试与覆盖率

server 使用 Vitest + V8 coverage，并对 Shopify 相关逻辑设 100% 阈值：

```bash
pnpm --dir apps/server run test:coverage
pnpm --dir apps/server run test:coverage:view
```

coverage include 聚焦 Shopify app-flow、Shopify middleware、provider、resource API 等文件。这样测试目标和项目核心风险对齐，而不是追求无差别全仓覆盖。
