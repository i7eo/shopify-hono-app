# Env Design

本文说明服务端 env 的解析、合并和缓存方式。业务代码不直接解析 `process.env` 或 `c.env`，只使用已校验的 `runtimeEnv`。

## 目标

env 层只负责：

1. 在 bootstrap 阶段读取字符串 env。
2. 在 request 阶段合并平台 binding。
3. 根据 `APP_RUNTIME` 选择 process 或 isolate schema。
4. 通过 provider 返回已校验的 `RuntimeConfig`。

## 两个调用点

### Bootstrap

启动阶段还没有 Hono context，因此只能读取进程已注入的字符串 env：

```ts
getEnvProvider(process.env);
```

Node process 会在启动时调用它。Cloudflare isolate 的请求级 binding 不要求在 bootstrap 阶段存在。

### Request

进入请求后，`runtimeEnvMiddleware` 会通过 runtime capability 获取最新 env source：

```ts
const runtimeEnv = getEnvProvider(envConfig);
c.set("runtimeEnv", runtimeEnv);
```

Cloudflare 下 `envConfig` 来自 `c.env`，其中包含 KV binding。Node 下来自 `process.env`。

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

签名只包含关键配置字段和 `sofary` binding 是否存在，不会把 KV binding 对象整体 stringify。

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

当前 Cloudflare isolate schema 会校验 KV binding `sofary` 是否存在并具备 `get`、`put`、`delete`、`list` 方法。

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

1. 业务代码优先从 `c.get("runtimeEnv")` 获取 env。
2. provider 内部可以缓存已校验 config，但不能缓存每个请求的业务数据。
3. Cloudflare binding 必须在 request 阶段通过 `c.env` 合并。
4. `APP_RUNTIME` 是事实配置，不新增 `APP_RUNTIME_MODE`。
5. 新增 runtime 时，需要同步扩展 schema、capability 和 runtime entry。
