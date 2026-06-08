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

1. 业务代码通过 provider、middleware 或 capability 获取 runtime 能力。
2. Node-only 依赖只出现在 process entry、process capability 或 `.node.ts` 文件中。
3. Cloudflare entry 不静态导入 `node:*`、`@hono/node-server`、`@logtape/file`。
4. `APP_RUNTIME=cloudflare` 时，request-bound binding 从 `c.env` 进入。
5. `vercel-edge` 当前只作为未来扩展预留，不作为可部署目标。

## 相关文档

- Env 解析和 provider 缓存见 [env.md](./env.md)。
- Logger 在不同 runtime 下的 sink 策略见 [logger.md](./logger.md)。
- Shopify session storage 的 runtime 差异见 [shopify.md](./shopify.md)。
