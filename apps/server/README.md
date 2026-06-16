# Server Docs

这里是 `apps/server` 的文档入口。`apps/server` 是一个基于 Hono 的 Shopify app 服务端，支持 `embedded` 与 `standalone` 两种 Shopify app mode，并同时支持 Node process 和 Cloudflare Workers isolate。

## 当前项目状态

- Runtime: Node process 和 Cloudflare Workers，通过 `APP_RUNTIME` 选择。
- Framework: Hono + TypeScript。
- Shopify: 使用 `@shopify/shopify-api` 官方包处理 OAuth、session token、token exchange、webhook 校验和 Admin GraphQL client。
- Shopify app mode: `SHOPIFY_APP_MODE=embedded|standalone` 必须显式配置；embedded 使用 App Bridge session token，standalone 使用 app account session cookie。
- Shopify frontend target: `SHOPIFY_APP_FRONTEND_TARGET=backend|frontend` 决定 app shell 由 server 还是 web 承载。
- Session storage: Cloudflare 使用 D1 或 Hyperdrive PostgreSQL；Node development 使用 memory；Node production 不允许 memory session。
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

`apps/server` 的脚本按 runtime 分为 Node process 与 Cloudflare Workers 两组。
本地 Shopify 联调通常由根目录 `pnpm dev` 或 `pnpm dev:tunnel` 间接启动。

| Script               | Purpose                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| `cf:type`            | 生成 Cloudflare Worker binding 类型到 `typings/cloudflare-worker-configuration.d.ts`。 |
| `cf:dev`             | 读取 development env，用 Wrangler dev 启动 Cloudflare Worker runtime。                 |
| `cf:build`           | 读取 production env，构建 Cloudflare isolate 产物到 `dist/isolate/cloudflare`。        |
| `cf:deploy`          | 准备 Cloudflare 静态资源配置，批量写入 Wrangler secrets，然后执行 `wrangler deploy`。  |
| `node:dev`           | 读取 development env，用 `tsx watch` 启动 Node process runtime。                       |
| `node:build`         | 读取 production env，构建 Node process 产物到 `dist/process`。                         |
| `node:deploy`        | 运行 Node 部署脚本，生成 Compose/Nginx 并部署 Docker + PM2 runtime。                   |
| `build`              | 依次运行 `cf:build` 和 `node:build`。                                                  |
| `test`               | 运行 Vitest。                                                                          |
| `test:coverage`      | 运行 Vitest coverage。                                                                 |
| `test:coverage:view` | 打开 coverage HTML 报告。                                                              |
| `format`             | 格式化 server workspace 内的 JS/TS/Markdown/JSON 文件。                                |
| `lint`               | 修复 server workspace 内的 ESLint 问题。                                               |
| `clean`              | 并行运行 server workspace 清理任务。                                                   |
| `clean:cache`        | 删除 `dist`。                                                                          |
| `clean:deps`         | 删除 `node_modules`。                                                                  |

`shopify app dev` 会为 server web target 注入 `BACKEND_PORT`、`APP_URL`、`HOST`
等运行期值。`cf:dev` 把 `BACKEND_PORT` 传给 Wrangler 的 `--port`，并通过
`--var "SHOPIFY_APP_URL:${APP_URL:-$HOST}"` 把本次 dev tunnel URL 传入
Worker。`node:dev` 通过前置 env 赋值把 `BACKEND_PORT` 映射为
`APP__SERVER_PORT`，并把 `APP_URL`/`HOST` 映射为 `SHOPIFY_APP_URL`，保证 Node
runtime 和 Cloudflare runtime 使用同一套 Shopify CLI 注入语义。

本地 Shopify 开发入口仍以根目录脚本为准：

```bash
pnpm dev
```

该命令会先生成 Shopify 配置文件，再由 Shopify CLI 启动开发流程。根目录的
`pnpm app:dev` 只是原始 Shopify CLI 启动命令，通常不要绕过 `pnpm dev`
直接执行。

生产部署也以根目录脚本为准：

```bash
pnpm deploy
```

`pnpm deploy` 会先写入 Shopify TOML，再按 `.env.production` 中的
`APP_RUNTIME` 分发到 server workspace：

```bash
pnpm --dir apps/server run cf:deploy
pnpm --dir apps/server run node:deploy
```

`cf:deploy` 先运行 `scripts/deploy/cloudflare.ts` 写入 Worker assets 配置，
再执行 `wrangler secret bulk ../../.env.production && wrangler deploy`。
`node:deploy` 运行 `scripts/deploy/node.ts`，构建 web/server 产物，生成
`docker-compose.yml` 与 `nginx.conf`，然后通过 Docker、PM2 runtime 和
同机 Nginx 完成部署。

## 维护原则

1. 文档只记录当前代码事实，不保留过期设计草案。
2. Shopify app-flow 和 Admin API 访问能力写在 [shopify.md](./docs/shopify.md)，runtime/build 细节写在 [runtime.md](./docs/runtime.md)。
3. Env、Logger、Error 各自只说明自己的基础设施边界。
4. 如果某个说明已经有专门文档，其他文档只简要介绍并链接过去。
