<!-- eslint-disable unicorn/filename-case -->

# `@shamt/web`

`apps/web` 是 Shopify app 的前端工作区，使用 Vite、React、TanStack Router、TanStack Query 和 Tailwind CSS v4。Admin UI 以 Shopify Polaris web components 为主，浏览器侧通过构建期注入的 public env 感知 runtime、mode 和 frontend target，不直接读取 Node/Vite 侧完整 env。

## 启动

从 `apps/web` 工作区启动时，脚本会通过 Node 的 `--env-file` 读取仓库根目录 env file，并用 `tsx/esm` 让 Vite config 可以直接加载 workspace TypeScript 包。

```sh
pnpm -F @shamt/web dev
pnpm -F @shamt/web build
pnpm -F @shamt/web test
```

对应脚本：

```sh
node --env-file=../../.env.development --import tsx/esm ./node_modules/vite/bin/vite.js
node --env-file=../../.env.production --import tsx/esm ./node_modules/vite/bin/vite.js build
```

`tsx/esm` 只解决 Vite config 在本地直接加载 workspace TS 源码的问题，不代表所有 Node 入口都能自动解析扩展名不完整的 ESM import。

## Env 分层

Node/Vite 侧配置集中在 [`configs/env.ts`](./configs/env.ts)。它使用 `@shamt/app-env` 的 `configSchema` 校验 `process.env`，并导出校验后的 `env` 给 `vite.config.ts` 和 Vite plugins 使用。

浏览器侧代码不要 import `configs/env.ts`。该文件会读取完整 env，其中包含 Shopify secret、Redis、database 等服务端配置。`src` 下如果需要 runtime、mode、frontend target 等公开值，统一从 [`src/utils/public-env.ts`](./src/utils/public-env.ts) 获取。

## HTML 与 Public Env 注入

[`scripts/vite/plugins/html.ts`](./scripts/vite/plugins/html.ts) 负责替换 `index.html` 中的 Shopify 占位符：

- `%SHOPIFY_APP_FRONTEND_NAME%`
- `%SHOPIFY_APP_FRONTEND_HEAD%`

它会写入 `app-runtime`、`shopify-api-key`、`shopify-app-mode` meta，并根据 `SHOPIFY_APP_MODE` 决定是否加载 App Bridge。Polaris web components 脚本由 HTML head 模板承载。

[`scripts/vite/plugins/public-env.ts`](./scripts/vite/plugins/public-env.ts) 会接收已校验的完整 env，过滤敏感字段后写入 HTML head，并注册为只读全局变量：

```text
globalThis.__PUBLIC_ENV__
```

业务代码使用：

```text
import {
  getShopifyAppMode,
  isEmbeddedShopifyApp,
  isNodeRuntime,
} from "@/utils/public-env";
```

全局变量类型声明在 [`typings/index.d.ts`](./typings/index.d.ts)。如果 VSCode 对 `globalThis.__PUBLIC_ENV__` 或 `globalThis.shopify` 报类型错误，先执行 `TypeScript: Restart TS Server`；声明本身使用 `declare global { var ... }`，命令行 `tsc` 已可识别。

## 敏感 Key 防护

[`constants/index.ts`](./constants/index.ts) 定义 public env 全局变量名和敏感 env key 标识：

```text
export const PUBLIC_ENV_GLOBAL_NAME = "__PUBLIC_ENV__";

export const SENSITIVE_ENV_KEY_IDENTIFIERS = [
  "secret",
  "scope",
  "redis",
  "database",
  "password",
  "pwd",
  "private",
  "token",
  "id",
] as const;
```

`publicEnvPlugin` 会用大小写不敏感正则检查 env key。命中这些标识的字段会被过滤，不会注入浏览器。因为当前策略是“传入完整 env 后过滤敏感字段”，新增 secret、token、database、Redis、ID 类字段时必须确认 key 命名能被这组标识捕获。

`globalName` 仍会被校验为合法 JavaScript 标识符，避免生成不可执行的 inline script。

## Vite Dev Server

Vite dev server 配置集中在 [`scripts/vite/server.ts`](./scripts/vite/server.ts)，并拆分出：

- [`scripts/vite/allowed-hosts.ts`](./scripts/vite/allowed-hosts.ts)：从 `SHOPIFY_APP_URL`、Shopify CLI tunnel env、`VITE_ALLOWED_HOSTS` 等来源生成 `server.allowedHosts`。
- [`scripts/vite/proxy.ts`](./scripts/vite/proxy.ts)：把 `/api`、`/auth`、`/webhooks` 代理到 `apps/server`。

`shopify app dev` 会注入 `FRONTEND_PORT` 和 `BACKEND_PORT`。`apps/web` 会优先使用这两个端口；没有注入时回退到 `APP__WEB_PORT` 和 `APP__SERVER_PORT`。

## Build 图片优化

[`scripts/vite/plugins/image-optimizer.ts`](./scripts/vite/plugins/image-optimizer.ts) 只在 `vite build` 时启用。它会优化 `public` 与 `src/assets` 中的图片，并在安装了 `svgo` 时额外处理 SVG。

开发模式不启用图片优化，避免拖慢 `pnpm dev` 和 React Refresh。

## HTTP Client 边界

浏览器侧 HTTP client 统一从 [`src/utils/client.ts`](./src/utils/client.ts) 获取：

```text
import { apiClient, client, HttpRequestError } from "@/utils/client";
```

- `client`：通用 HTTP client，不带 API prefix，适合请求完整 URL。
- `apiClient`：基于 `client.extend()` 创建，带 `/${DEFAULT_APP_API_PREFIX}` prefix，适合请求当前 app server API。
- `HttpRequestError`：也从这里 re-export，`src/apis/*` 不直接 import `@shamt/oh-my-fetch`。

Shopify API 请求在 [`src/apis/shopify.ts`](./src/apis/shopify.ts) 中使用 `apiClient`，并根据 `SHOPIFY_APP_MODE` 区分 embedded 与 standalone：

- embedded：通过 `globalThis.shopify?.idToken()` 设置 `Authorization`。
- standalone：使用 cookie 凭证。

## 目录边界

- `configs/`：Node/Vite 侧配置，只允许 Vite config、scripts、plugins 使用。
- `constants/`：web package 层常量，主要给 Vite plugins 使用。
- `scripts/vite/`：Vite plugin 与构建期逻辑。
- `src/utils/public-env.ts`：浏览器侧 public env 唯一入口。
- `src/utils/client.ts`：浏览器侧 HTTP client 唯一入口。
- `src/utils/client.query.ts`：React Query client 工厂，避免组件重复创建缓存实例。
- `typings/`：Polaris web components、App Bridge 和 public env 全局类型。

保持这个边界可以避免服务端 env、Zod schema 或 Node-only 逻辑进入浏览器 bundle。
