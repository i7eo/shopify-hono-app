# Shopify App 逻辑说明

介绍我们的 Shopify App 在服务端是怎么工作的。读完以后，你应该能回答三个问题：

1. 商家打开 App 时发生了什么。
2. 后端为什么能安全访问商家的 Shopify 店铺数据。
3. Node 和 Cloudflare 两种运行环境有什么区别。

## 一句话版本

这个服务端不是自己发明一套 Shopify 登录、验签、令牌和会话逻辑，而是尽量交给 Shopify 官方包处理。

我们主要使用这些官方包：

- `@shopify/shopify-api`: 负责 Shopify App 的 OAuth、session token、token exchange、webhook 校验、Admin GraphQL client。
- `@shopify/shopify-app-session-storage-kv`: Cloudflare runtime 使用 Cloudflare KV 保存 Shopify session。
- `@shopify/shopify-app-session-storage-memory`: Node 本地开发时用内存保存 Shopify session。

## 核心概念

### App Shell

App Shell 可以理解为 Shopify 后台里显示出来的应用页面。商家在 Shopify Admin 打开我们的 App 时，浏览器会加载这个页面。

对应代码：

- `src/app/modules/shopify/app-shell/index.ts`

当前页面会加载两个 Shopify 官方脚本：

- App Bridge: 让嵌入式 App 能和 Shopify Admin 通信。
- Polaris Web Components: Shopify 官方 UI 组件。

App Shell 页面里会请求：

- `/api/shopify/shop`: 读取店铺基本信息。
- `/api/shopify/products`: 读取商品列表。

这些请求会由 App Bridge 自动带上 Shopify session token。

### Session Token

Session token 是 Shopify Admin 给前端的一张短期身份证。它证明“这个请求确实来自 Shopify Admin 中的某个已登录用户”。

服务端不会自己解析这张身份证，而是调用 Shopify 官方方法：

- `shopify.session.decodeSessionToken(...)`

对应代码：

- `src/shared/middlewares/shopify/verify-session-token.ts`

### Token Exchange

Session token 只能证明用户身份，不能直接拿来调用 Shopify Admin API。

所以服务端会做 token exchange：把前端带来的 session token 换成可以访问 Shopify Admin API 的 access token。

这一步也使用 Shopify 官方方法：

- `shopify.auth.tokenExchange(...)`

对应代码：

- `src/shared/middlewares/shopify/token-exchange.ts`
- `src/app/modules/shopify/session.ts`

现在 token exchange 的核心逻辑集中在 `session.ts`：

- 先尝试从 session storage 读取当前请求对应的 online session。
- 如果 session 还有效，就复用。
- 如果没有可用 session，就用当前请求里的 session token 调用 Shopify 官方 token exchange。
- 换到的新 session 会保存回 session storage。

这样中间件本身只负责串联流程，具体 session 逻辑不会分散在多个地方。

### Admin API 自动刷新

有一种情况比较常见：本地或 KV 里保存的 session 看起来还没过期，但 Shopify Admin API 实际返回了 `401 Unauthorized`。这可能是 token 被 Shopify 侧撤销、重新授权、scope 变化或本地存储里残留了旧 token。

现在后端会自动处理一次：

1. 先用当前 session 调用 Shopify Admin API。
2. 如果 Shopify 返回 `401`，服务端删除当前 online session。
3. 用当前请求里的 session token 重新做一次 Shopify 官方 token exchange。
4. 用新 session 重新创建 GraphQL client。
5. 同一个请求只重试一次。

对应代码：

- `src/app/modules/shopify/admin.ts`
- `src/app/modules/shopify/session.ts`

这可以避免商家遇到旧 token 时直接看到接口 502，也避免要求前端手动清缓存或重新打开 App。

### Session Storage

Token exchange 得到的 Shopify session 需要保存起来，下次请求可以复用，避免每次都重新换 token。

不同运行环境保存方式不同：

- Cloudflare Workers: 无论 `APP_ENV` 是什么，都使用 Cloudflare KV。
- Node development: 使用内存。
- Node production: 当前不允许使用内存，会直接报错，避免线上 session 丢失。
- Vercel Edge: 只是预留 runtime 类型，目前没有完整支持。

对应代码：

- `src/app/modules/shopify/session-storage.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`
- `src/app/runtime/process/capabilities.ts`

### Webhook

Webhook 是 Shopify 主动通知我们的消息。例如商家卸载 App、客户数据请求、店铺数据删除请求。

Webhook 必须验签，否则任何人都可以伪造 Shopify 通知。

我们不自己写验签逻辑，而是调用 Shopify 官方方法：

- `shopify.webhooks.validate(...)`

对应代码：

- `src/shared/middlewares/shopify/verify-webhook.ts`
- `src/app/modules/shopify/webhook/index.ts`

## 路由总览

| 路径                               | 用途                         | 是否需要 Shopify 身份 |
| ---------------------------------- | ---------------------------- | --------------------- |
| `/`                                | App Shell 首页               | 否，页面本身不查数据  |
| `/app`                             | App Shell 页面               | 否，页面本身不查数据  |
| `/app/*`                           | App Shell 子页面             | 否，页面本身不查数据  |
| `/auth`                            | 开始 Shopify OAuth 安装/授权 | Shopify OAuth 流程    |
| `/auth/callback`                   | Shopify OAuth 回调           | Shopify OAuth 流程    |
| `/api/shopify/shop`                | 查询店铺信息                 | 是                    |
| `/api/shopify/products`            | 查询商品列表                 | 是                    |
| `/webhooks/app/uninstalled`        | App 卸载通知                 | Webhook 验签          |
| `/webhooks/customers/data-request` | 客户数据请求                 | Webhook 验签          |
| `/webhooks/customers/redact`       | 客户数据删除请求             | Webhook 验签          |
| `/webhooks/shop/redact`            | 店铺数据删除请求             | Webhook 验签          |

## 商家打开 App 的完整流程

### 1. 商家在 Shopify Admin 打开 App

浏览器访问我们的 App 页面：

- `/`
- `/app`
- `/app/...`

服务端返回 App Shell 页面。

相关代码：

- `src/app/modules/shopify/app-shell/index.ts`

### 2. 页面加载 Shopify 官方脚本

页面里加载：

- `https://cdn.shopify.com/shopifycloud/app-bridge.js`
- `https://cdn.shopify.com/shopifycloud/polaris.js`

App Bridge 会帮前端请求自动带上 session token。

### 3. 页面请求后端 API

页面请求：

- `/api/shopify/shop`
- `/api/shopify/products`

这些接口不是开放接口，必须先通过两个中间件：

1. `verifySessionToken`
2. `tokenExchange`

### 4. 服务端验证 session token

服务端检查请求头里的：

```txt
Authorization: Bearer <session_token>
```

然后用 Shopify 官方包验证 token。

验证通过后，服务端知道：

- 请求来自哪个 Shopify 店铺。
- 请求来自哪个 Shopify 用户。

### 5. 服务端换取 Admin API access token

如果本地 session storage 里已经有可用 session，就直接复用。

如果没有可用 session，就用 Shopify 官方 token exchange 换取新的 session，并保存起来。

这里使用的是 online session，也就是和当前 Shopify Admin 用户相关的 session。

### 6. 服务端请求 Shopify Admin API

拿到可用 session 后，服务端创建 Shopify 官方 GraphQL client：

- `new shopify.clients.Graphql({ session })`

然后请求 Shopify Admin API。

相关代码：

- `src/infra/http/shopify.ts`
- `src/app/modules/shopify/admin.ts`
- `src/app/modules/shopify/shop/service.ts`
- `src/app/modules/shopify/product/service.ts`

如果 Shopify Admin API 返回 `401 Unauthorized`，服务端会自动刷新一次 online session，并用新 session 重试同一个查询。这个刷新只发生一次，避免无限重试。

## App 安装和授权流程

安装或授权从 `/auth` 开始。

### `/auth`

作用：把商家带到 Shopify 的授权页面。

服务端会检查 `shop` 参数是不是合法的 `*.myshopify.com` 域名。

然后调用 Shopify 官方方法：

- `shopify.auth.begin(...)`

### `/auth/callback`

作用：Shopify 授权完成后跳回我们的服务端。

服务端调用 Shopify 官方方法：

- `shopify.auth.callback(...)`

这个方法会校验 OAuth 回调，并返回 session。服务端保存 session 后，把商家重定向回 App 页面。

对应代码：

- `src/app/modules/shopify/auth/index.ts`

## Webhook 处理流程

Webhook 路由统一挂在：

- `/webhooks`

所有 webhook 请求都会先经过：

- `verifyWebhook`

这个中间件做三件事：

1. 读取原始请求 body。
2. 调用 Shopify 官方 `shopify.webhooks.validate(...)` 验签。
3. 验签通过后，把 topic、shop、payload 放进请求上下文。

然后具体 webhook handler 再处理业务。

当前已处理的 webhook：

- App 卸载时，删除该店铺保存的 session。
- 客户数据请求，记录日志并返回成功。
- 客户数据删除请求，记录日志并返回成功。
- 店铺数据删除请求，记录日志并返回成功。

## Node 和 Cloudflare 的区别

这个项目支持两种正式运行环境：

```txt
APP_RUNTIME=node
APP_RUNTIME=cloudflare
```

### Cloudflare Workers

Cloudflare 使用 KV 保存 Shopify session。

只要 `APP_RUNTIME=cloudflare`，就使用 `@shopify/shopify-app-session-storage-kv`，不受 `APP_ENV` 影响。

对应代码：

- `src/app/runtime/isolate/cloudflare/capabilities.ts`

逻辑是：

```txt
Cloudflare request context 里拿到 KV binding
然后创建 Shopify 官方 KVSessionStorage
```

也就是：

- `new KVSessionStorage(c.env.sofary)`

### Node

Node 只在 development 环境允许使用 memory session storage。

也就是只有下面这种组合会使用 `@shopify/shopify-app-session-storage-memory`：

对应代码：

- `src/app/runtime/process/capabilities.ts`

允许：

```txt
APP_RUNTIME=node
APP_ENV=development
```

不允许：

```txt
APP_RUNTIME=node
APP_ENV=production
```

原因是内存会随进程重启丢失，不能作为线上 session 存储。

### Vercel Edge

`vercel-edge` 目前只是预留类型，不是当前正式支持的部署目标。

它还没有完整的：

- runtime entry
- platform binding
- Shopify session storage
- 部署配置

所以当前不要把它当作可上线 runtime 使用。

更完整的 runtime 入口、构建产物和 Cloudflare 类型生成说明见 [runtime.md](./runtime.md)。

## 关键文件职责

| 文件                                                     | 职责                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `src/app/modules/shopify/index.ts`                       | 注册所有 Shopify 相关路由                                     |
| `src/app/modules/shopify/config.ts`                      | 创建 Shopify 官方 SDK 配置                                    |
| `src/infra/provider/shopify.ts`                          | 缓存 app 级 Shopify SDK 配置，并创建当前请求的 Shopify client |
| `src/app/modules/shopify/app-shell/index.ts`             | 返回 Shopify Admin 中显示的 App 页面                          |
| `src/app/modules/shopify/auth/index.ts`                  | 处理 OAuth 安装和回调                                         |
| `src/app/modules/shopify/admin.ts`                       | 执行 Admin API 请求，遇到 401 时刷新 session 并重试一次       |
| `src/app/modules/shopify/session.ts`                     | 读取、换取、刷新和写入 Shopify online session                 |
| `src/app/modules/shopify/session-storage.ts`             | 根据 runtime 获取 session storage                             |
| `src/shared/middlewares/shopify/verify-session-token.ts` | 验证前端请求带来的 session token                              |
| `src/shared/middlewares/shopify/token-exchange.ts`       | 换取或复用 Shopify Admin API access token                     |
| `src/shared/middlewares/shopify/verify-webhook.ts`       | 验证 Shopify webhook                                          |
| `src/app/modules/shopify/shop/service.ts`                | 请求 Shopify 店铺信息                                         |
| `src/app/modules/shopify/product/service.ts`             | 请求 Shopify 商品列表                                         |
| `src/app/modules/shopify/webhook/index.ts`               | 处理具体 webhook 事件                                         |
| `src/infra/http/shopify.ts`                              | 使用当前请求的 Shopify session 创建 Admin GraphQL client      |
| `src/app/runtime/isolate/cloudflare/capabilities.ts`     | 注册 Cloudflare 专用能力                                      |
| `src/app/runtime/process/capabilities.ts`                | 注册 Node 专用能力                                            |

## 为什么要用 provider

可以把 provider 理解成“统一取工具的地方”。

例如 Shopify SDK 配置需要用到：

- app key
- app secret
- app url
- scopes
- api version
- logger

这些配置不应该散落在每个文件里重复创建，所以放在：

- `src/infra/provider/shopify.ts`

其中：

- Shopify app 级配置会缓存。
- 每次请求 Shopify Admin API 时，会用当前请求的 session 创建新的 GraphQL client。
- env provider 会按关键配置字段生成签名。配置没变时，不会每次请求都重新解析 env。
- Shopify config provider 也会按 app key、app secret、app url、api version、scopes 生成签名。签名没变时，复用同一个 Shopify SDK 配置。

这样既避免重复创建固定配置，又避免把某个商家的 session 错误复用到另一个请求里。

## 安全边界

### 我们自己不做的事

这些都交给 Shopify 官方包：

- OAuth 校验。
- Session token 解析。
- Token exchange。
- Webhook HMAC 验签。
- Admin GraphQL client 创建。

### 我们自己负责的事

这些仍然由项目代码负责：

- 检查 `/auth` 传入的 shop 域名格式。
- 决定 session 存在哪里。
- 决定哪些 API 需要 Shopify 身份。
- 处理 webhook 业务。
- 记录日志。
- 统一错误响应。

## 常见问题

### 为什么 `/api/shopify/shop` 和 `/api/shopify/products` 前面要加 `/api/shopify`

为了把 Shopify 相关 API 和项目自己的普通 API 分开。

例如：

- `/api/health` 是项目自身健康检查。
- `/api/shopify/shop` 是需要 Shopify 身份的接口。

这样不会误把普通 API 放进 Shopify 鉴权链路，也不会误把 Shopify API 当成普通公开接口。

### 为什么 Node production 不允许 memory session

内存 session 会在进程重启、服务扩容、容器迁移时丢失。

线上如果使用 memory session，商家可能突然需要重新授权，甚至出现 session 找不到的问题。

所以当前只允许 Node development 使用 memory session。

### 为什么 Cloudflare 使用 KV

Cloudflare Workers 没有传统服务器磁盘，也不适合依赖进程内存长期保存数据。

KV 是 Cloudflare 提供的持久存储，适合保存 Shopify session。

### 为什么 Admin GraphQL client 不做全局缓存

因为 Admin GraphQL client 绑定的是当前 Shopify session。

不同商家、不同用户、不同 access token 都可能不同。如果全局缓存，容易出现拿错 session 的风险。

所以固定的 Shopify SDK 配置可以缓存，但带 session 的 Admin client 按请求创建。

### 为什么旧 session 会导致 401，后端又能自动恢复

本地或 KV 里保存的 session 可能还没到过期时间，但 Shopify 侧已经不接受它了。

这种情况下，第一次 Admin API 请求会返回 `401 Unauthorized`。后端会认为“这个 session 不能再用了”，然后：

1. 删除当前 online session。
2. 用当前请求里的 session token 重新换一个新 session。
3. 用新 session 重试一次 Admin API 请求。

如果重试后仍然失败，就会按普通 Shopify 上游错误处理。

### Webhook 为什么一定要验签

Webhook 是外部请求。如果不验签，任何人都可以假装 Shopify 调用我们的接口。

所以 webhook 必须先通过 Shopify 官方验签，业务代码才会执行。

## 出问题时看哪里

| 现象                               | 优先检查                                                              |
| ---------------------------------- | --------------------------------------------------------------------- |
| App 页面打不开                     | `app-shell/index.ts`、`SHOPIFY_APP_KEY`、`SHOPIFY_APP_URL`            |
| 安装或授权失败                     | `auth/index.ts`、Shopify app 配置里的 callback URL                    |
| API 返回 401                       | `verify-session-token.ts`，确认前端请求是否带 session token           |
| API 返回 502 token exchange failed | `session.ts`、`token-exchange.ts`，确认 app secret、scopes、shop 域名 |
| Admin API 第一次返回 401           | `admin.ts`、`session.ts`，确认是否触发自动刷新和一次重试              |
| Shopify 数据查不到                 | `shop/service.ts`、`product/service.ts`，确认 scopes 是否足够         |
| Webhook 失败                       | `verify-webhook.ts`，确认 webhook secret/app secret 和 raw body       |
| Cloudflare session 找不到          | KV binding `sofary`、`cloudflare/capabilities.ts`                     |
| Node 本地 session 异常             | `APP_ENV` 是否是 `development`                                        |
| Wrangler 类型文件提交报错          | 确认 `lint-staged.config.ts` 已过滤生成的 Cloudflare typings          |

## 当前测试覆盖

Shopify 相关测试主要在：

- `tests/shopify/config-provider.test.ts`
- `tests/shopify/routes-shell.test.ts`
- `tests/shopify/session-middleware.test.ts`
- `tests/shopify/services-controllers.test.ts`
- `tests/shopify/webhook-routes.test.ts`
- `tests/provider.test.ts`

这些测试覆盖了：

- Shopify SDK 配置。
- App Shell 页面。
- OAuth 路由。
- Session token 校验。
- Token exchange。
- Webhook 校验。
- Node/Cloudflare session storage。
- Shopify API controller/service。
- Admin API 401 后刷新 online session 并重试一次。
- provider env 缓存和 provider dispose 行为。
