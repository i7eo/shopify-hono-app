# Runtime Design

本文说明 `apps/server` 的运行时边界：项目同时支持 Node process 和 Cloudflare Workers isolate，但业务代码尽量不直接感知平台差异。

## 当前支持状态

| Runtime       | 执行模型 | 状态     | 说明                                      |
| ------------- | -------- | -------- | ----------------------------------------- |
| `node`        | process  | 正式支持 | 本地开发、普通 Node 服务、Node build 目标 |
| `cloudflare`  | isolate  | 正式支持 | Cloudflare Workers、KV session storage    |
| `vercel-edge` | isolate  | 预留     | 只有类型预留，没有完整入口和部署配置      |

项目只让用户配置事实型变量 `APP_RUNTIME`，不再额外配置 `APP_RUNTIME_MODE`。执行模型由代码根据 `APP_RUNTIME` 推导。

## 入口文件

| Runtime      | 入口                                          | 作用                                       |
| ------------ | --------------------------------------------- | ------------------------------------------ |
| Node process | `src/app/runtime/process/index.ts`            | 注册 Node 能力并启动 server                |
| Cloudflare   | `src/app/runtime/isolate/cloudflare/index.ts` | 注册 Cloudflare 能力并导出 `fetch` handler |

Node entry 可以使用 `@hono/node-server`、进程信号、Node 文件系统等能力。Cloudflare entry 只导出 Worker module handler，不能静态引入 Node-only 实现。

`bootstrapApp()` 永远保持 runtime-agnostic。它只创建通用 Hono app、注册 middleware、routes、lifecycle 和可选 OpenAPI，不接收 runtime 参数，也不分支处理平台能力。runtime-specific 行为只允许放在 runtime entry 或 runtime capability 中。

## Runtime Capabilities

跨 runtime 的平台能力通过 capability registry 注入：

- `runtimeLoggerSetup`
- `runtimeEnvSourceResolver`
- `processDiskHealthChecker`
- `shopifySessionStorageFactory`

对应文件：

- `src/app/runtime/capabilities.ts`
- `src/app/runtime/process/capabilities.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`

共享业务代码只读取 capability，不直接 import Node-only 或 Cloudflare-only 实现。这样可以保护 Cloudflare bundle 的 import graph。

### Cloudflare Binding 校验

Cloudflare request-bound binding 不要求在 bootstrap 阶段存在。schema 允许这类字段 optional，runtime capability 在真正使用时负责强校验。

例如 Shopify session storage 在 Cloudflare capability 中读取 `c.env.sofary`，并通过 `requireCloudflareBinding(...)` 校验：

```ts
const namespace = requireCloudflareBinding(
  context.env.sofary,
  "sofary",
  isCloudflareKVNamespace,
);
```

这条边界保证：

- Worker 模块 import 阶段可以只依赖 `process.env` 中的字符串配置完成 app/bootstrap。
- request 进入后，`runtimeEnvMiddleware` 从 `c.env` 合并平台 binding。
- 业务代码不需要到处判断平台 binding 是否存在。

## Hono Runtime Env Types

业务模块使用通用 `AppEnv`，让 controller、middleware、provider 不感知具体 runtime。runtime 入口可以使用具体类型收窄：

```ts
RuntimeAppEnv<"node">;
RuntimeAppEnv<"cloudflare">;
RuntimeAppEnv<"vercel-edge">;
```

Cloudflare Worker 入口使用 `RuntimeAppEnv<"cloudflare">` 作为 `ExportedHandler` bindings 类型。这个类型从 `RuntimeConfig` union 推导，不手写重复 env 字段。

## Shopify Mode Capabilities

Shopify app mode 不是 runtime capability。它由 `SHOPIFY_APP_MODE` 决定，和 `APP_RUNTIME` 正交：

| 配置               | 维度           | 示例                     |
| ------------------ | -------------- | ------------------------ |
| `APP_RUNTIME`      | 执行环境       | `node`、`cloudflare`     |
| `SHOPIFY_APP_MODE` | Shopify app 流 | `embedded`、`standalone` |

Shopify mode capability 只负责 app-flow 差异，例如 App Shell、OAuth callback redirect、Admin request session strategy。它位于：

- `src/app/modules/shopify/mode`

runtime capability 仍只负责平台差异，例如 logger、env source、KV/memory session storage。

## 构建目标

| 目标               | 构建配置                             | 输出目录                  |
| ------------------ | ------------------------------------ | ------------------------- |
| Node process       | `build.process.config.ts`            | `dist/process`            |
| Cloudflare isolate | `build.isolate-cloudflare.config.ts` | `dist/isolate/cloudflare` |

对应脚本：

```bash
pnpm --dir apps/server run node:build
pnpm --dir apps/server run cf:build
```

两个脚本只清理自己的输出目录，因此可以先后构建并保留两套产物。

## OpenAPI 注册

`createApp()` 只创建 Hono app、注册 middleware、业务路由和 lifecycle，不默认注册 OpenAPI。

OpenAPI 由 `bootstrapApp({ registerOpenApi })` 控制：

- Node process: 非 production 注册 `/document` 和 `/reference`。
- Cloudflare isolate: 默认不注册 OpenAPI。
- production: 不注册 OpenAPI 和 Scalar，Scalar 使用动态 import，避免生产环境加载不必要代码。

对应文件：

- `src/app/bootstrap/create-app.ts`
- `src/app/bootstrap/index.ts`
- `src/app/bootstrap/register-openapi.ts`

## Cloudflare 类型

Cloudflare bindings 类型由 Wrangler 生成：

```bash
pnpm --dir apps/server run cf:type
```

输出文件：

- `typings/cloudflare-worker-configuration.d.ts`

这是生成物，不手动维护。提交前的 lint-staged 已过滤该文件，避免 ESLint/Prettier 修改 Wrangler 输出。

## 边界规则

1. `bootstrapApp()` 永远 runtime-agnostic，不接收 runtime 参数。
2. runtime-specific 行为只放在 runtime entry 或 runtime capability。
3. 业务模块只使用通用 `AppEnv`，不按 runtime 分支。
4. 平台 binding 在 schema 中可以 optional，但使用点必须通过 runtime capability 强校验。
5. 业务代码通过 provider、middleware 或 capability 获取 runtime 能力。
6. Node-only 依赖只出现在 process entry、process capability 或 `.node.ts` 文件中。
7. Cloudflare entry 不静态导入 `node:*`、`@hono/node-server`、`@logtape/file`。
8. `APP_RUNTIME=cloudflare` 时，request-bound binding 从 `c.env` 进入。
9. `vercel-edge` 当前只作为未来扩展预留，不作为可部署目标。

## 相关文档

- Env 解析和 provider 缓存见 [env.md](./env.md)。
- Logger 在不同 runtime 下的 sink 策略见 [logger.md](./logger.md)。
- Shopify session storage 的 runtime 差异见 [shopify.md](./shopify.md)。
