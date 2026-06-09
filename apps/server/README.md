# Server Docs

这里是 `apps/server` 的文档入口。`apps/server` 是一个基于 Hono 的 Shopify app 服务端，支持 `embedded` 与 `standalone` 两种 Shopify app mode，并同时支持 Node process 和 Cloudflare Workers isolate。

## 当前项目状态

- Runtime: Node process 和 Cloudflare Workers。
- Framework: Hono + TypeScript。
- Shopify: 使用 `@shopify/shopify-api` 官方包处理 OAuth、session token、token exchange、webhook 校验和 Admin GraphQL client。
- Shopify app mode: `SHOPIFY_APP_MODE=embedded|standalone` 必须显式配置；embedded 使用 App Bridge session token，standalone 使用 app account session cookie。
- Session storage: Cloudflare 使用 KV；Node development 使用 memory；Node production 不允许 memory session。
- Resource APIs: `shop`、`product` 已作为独立业务模块注册，复用 Shopify Admin middleware，不再放在 Shopify app-flow 模块下。
- OpenAPI: 非 production Node 可注册 `/document` 和 `/reference`；生产和 Cloudflare isolate 默认不注册。
- Env typing: Hono `AppEnv` 从 runtime schema 推导 bindings；runtime 入口可用 `RuntimeAppEnv<"cloudflare">` 等具体类型收窄。
- Cloudflare bindings: 平台 binding 在 schema 中允许 bootstrap 阶段缺失，并在 runtime capability 使用点强校验；Wrangler 生成类型到 `typings/cloudflare-worker-configuration.d.ts`。

## 文档导航

| 文档                                    | 内容边界                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| [runtime.md](./docs/runtime.md)         | Runtime 支持状态、入口、capability、构建产物、OpenAPI 注册策略                               |
| [env.md](./docs/env.md)                 | Env 来源、request binding 合并、schema 分发、provider 缓存                                   |
| [logger.md](./docs/logger.md)           | Bootstrap/runtime logger、process/isolate sink、错误日志入口                                 |
| [error.md](./docs/error.md)             | `AppError`、错误工厂、响应格式、生产环境暴露策略                                             |
| [shopify.md](./docs/shopify.md)         | Shopify app mode、App Shell、OAuth、account/session、Admin middleware、webhook、resource API |
| [technique.md](./docs/technique.md)     | DI、env 合并、binding 强校验、logger reset、import graph 隔离等架构技巧                      |
| [superiority.md](./docs/superiority.md) | Runtime 切换、embedded/standalone 双模式、session 策略等项目优势                             |

## 常用命令

```bash
pnpm --dir apps/server test
pnpm --dir apps/server run test:coverage
pnpm --dir apps/server run node:build
pnpm --dir apps/server run cf:build
pnpm --dir apps/server run cf:type
```

本地 Shopify 开发入口仍以根目录脚本为准：

```bash
pnpm app:dev
```

该命令会先生成 Shopify 配置文件，再由 Shopify CLI 启动开发流程。

## 维护原则

1. 文档只记录当前代码事实，不保留过期设计草案。
2. Shopify app-flow 和 Admin API 访问能力写在 [shopify.md](./docs/shopify.md)，runtime/build 细节写在 [runtime.md](./docs/runtime.md)。
3. Env、Logger、Error 各自只说明自己的基础设施边界。
4. 如果某个说明已经有专门文档，其他文档只简要介绍并链接过去。
