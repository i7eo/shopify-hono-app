# Env Design

本文说明服务端 env 的解析、合并和缓存方式。业务代码不直接解析 `process.env` 或 `c.env`，只使用已校验的 `runtimeEnv`。

## 目标

env 层只负责：

1. 在 bootstrap 阶段读取字符串 env。
2. 在 request 阶段合并平台 binding。
3. 根据 `APP_RUNTIME` 选择 process 或 isolate schema。
4. 通过 provider 返回已校验的 `RuntimeConfig`。

平台 binding 不在 bootstrap 阶段强制存在。它们可以随 `c.env` 在 request 阶段进入 provider，并由实际使用该 binding 的 runtime capability 做强校验。

## 两个调用点

### Module Constants

部分 route constants 会在模块 import 阶段读取 env provider：

```ts
const env = getEnvProvider();
```

这是项目刻意保持的全局 env 读取方式。它让 `APP_API_PREFIX` 等全局配置在 route metadata 创建时就固定下来，也避免同一类配置在不同模块里用不同读取方式。测试和启动环境必须提供完整基础 env，包括必填的 `SHOPIFY_APP_MODE`。

### Bootstrap

启动阶段还没有 Hono context，因此只能读取进程已注入的字符串 env：

```ts
getEnvProvider(process.env);
```

Node process 会在启动时调用它。Cloudflare isolate 也可能在模块 import 阶段读取 `process.env` 中的字符串配置，例如 route metadata 需要的 `APP_API_PREFIX`。请求级平台 binding 不要求在 bootstrap 阶段存在。

### Request

进入请求后，`runtimeEnvMiddleware` 会通过 runtime capability 获取最新 env source：

```ts
const runtimeEnv = getEnvProvider(envConfig);
c.set("runtimeEnv", runtimeEnv);
```

Cloudflare 下 `envConfig` 来自 `c.env`，其中包含 request-bound 平台 binding。Node 下来自 `process.env`。

对应文件：

- `src/shared/middlewares/runtime-env.ts`
- `src/infra/provider/env.ts`
- `src/app/runtime/process/capabilities.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`

## Provider 缓存

`getEnvProvider()` 内部保存两份状态：

- raw env 快照：用于 bootstrap env 与 request env 合并。
- env signature：用于判断有效配置是否变化。

如果签名没有变化，provider 会直接返回上一次解析好的 `RuntimeConfig`，不会每个请求都重新跑 schema parse。

签名只包含关键配置字段和平台 binding 是否存在，不会把 binding 对象整体 stringify。

## Runtime Schema

统一入口：

```ts
getRuntimeConfig(rawEnv);
```

内部流程：

```txt
normalizeEnv(rawEnv)
  -> 读取 APP_RUNTIME
  -> APP_RUNTIME=cloudflare/vercel-edge ? parseIsolateConfig
  -> APP_RUNTIME=node ? parseProcessConfig
```

当前 Cloudflare isolate schema 允许 request-bound binding 在 bootstrap 阶段缺失：

```ts
sofary?: KVNamespace
```

这不是静默放宽使用要求。真正消费 binding 的 runtime capability 必须在使用点强校验，例如 Cloudflare Shopify session storage 会通过 `requireCloudflareBinding(...)` 校验 `sofary` 存在且具备 `get`、`put`、`delete`、`list` 方法。

## Hono AppEnv 类型

Hono env 类型从 `RuntimeConfig` union 推导 bindings，避免新增普通 env 时重复维护手写 `Bindings`：

```ts
type RuntimeBindings<TRuntime extends RuntimeConfig["APP_RUNTIME"]> = Partial<
  Extract<RuntimeConfig, { APP_RUNTIME: TRuntime }>
>;

type RuntimeAppEnv<
  TRuntime extends RuntimeConfig["APP_RUNTIME"] = RuntimeConfig["APP_RUNTIME"],
> = {
  Bindings: RuntimeBindings<TRuntime>;
  Variables: Variables;
};
```

业务模块使用通用 `AppEnv`，不直接关心当前 runtime。runtime entry 或 capability 边界可以使用 `RuntimeAppEnv<"cloudflare">`、`RuntimeAppEnv<"node">` 等具体类型做局部收窄。

## Shopify 相关 env

Shopify app mode 是显式配置，不再有隐藏 fallback：

```txt
SHOPIFY_APP_MODE=embedded
SHOPIFY_APP_MODE=standalone
```

这个值同时影响：

- Shopify SDK 的 `isEmbeddedApp`。
- App Shell 是否加载 App Bridge。
- Admin API 请求使用 session token/token exchange，还是 standalone account session cookie。
- OAuth callback 后的 redirect 和 cookie 写入策略。

`APP_NAME` 也会影响 standalone account session cookie 名：

```txt
${APP_NAME}:account_session_cookie
```

默认值来自 `@shamt/envs` 的 `DEFAULT_APP_NAME`。如果修改 `APP_NAME`，已有浏览器 cookie 名也会变化，需要重新建立 standalone account session。

## normalizeEnv

`normalizeEnv` 把未知输入转换为普通对象，并对字符串值执行 `decodeURIComponent`。

它用于统一处理：

- `process.env`
- Cloudflare `c.env`
- 测试传入的普通对象

## 错误处理

env 解析失败会由 `runtimeEnvMiddleware` 转成统一错误：

```ts
throw internalServerError("runtime env errors", {
  details: { cause: error, message },
  expose: true,
});
```

错误响应规则见 [error.md](./error.md)。

## 规则

1. `bootstrapApp()` 永远 runtime-agnostic，不接收 runtime 参数。
2. runtime-specific 行为只放在 runtime entry 或 runtime capability。
3. 业务模块只使用通用 `AppEnv`，不按 runtime 分支。
4. 业务代码优先从 `c.get("runtimeEnv")` 获取 env。
5. provider 内部可以缓存已校验 config，但不能缓存每个请求的业务数据。
6. 平台 binding 必须在 request 阶段通过 `c.env` 合并，并在 capability 使用点强校验。
7. `APP_RUNTIME` 是事实配置，不新增 `APP_RUNTIME_MODE`。
8. `SHOPIFY_APP_MODE` 是 Shopify app-flow 配置，不要和 `APP_RUNTIME` 混用。
9. 新增 runtime 时，需要同步扩展 schema、capability 和 runtime entry。
