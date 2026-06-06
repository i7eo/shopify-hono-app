# Env Design

本文说明服务端 env 的设计边界。env 既要能在 app 启动时完成基础初始化，也要能在 route 进入后合并 request-bound bindings，因此它有两个调用点：bootstrap 和 route。

## 目标

env 设计只做四件事：

1. 启动期读取并校验进程中已经注入的字符串 env。
2. route 进入后合并最新 env 和 platform bindings。
3. 根据 `APP_RUNTIME` 选择 isolate / process schema。
4. 通过 provider 统一管理当前已校验 runtime env。

业务代码不直接解析 `process.env` 或 `c.env`。业务只从 Hono context 或 provider 中获取已校验的 runtime env。

## 为什么需要 bootstrap 调用点

app startup 阶段还没有 Hono route context。此时可能还没有：

- `c.env`
- Cloudflare KV/R2/D1 bindings
- requestId
- runtime middleware

但启动阶段仍然需要 env，例如：

- 初始化 bootstrap logger。
- 注册 process exception handlers。
- 判断 `APP_ENV` 是否为 development。
- 让启动期日志和 provider 使用同一份 env 入口。

项目启动时会把完整字符串 env 注入到进程，因此 bootstrap 阶段调用：

```ts
getEnvProvider(process.env);
```

bootstrap env 的原则：

- 读取进程内已经注入的字符串 env。
- 可以校验普通 string/number/boolean 配置。
- 不要求 Cloudflare binding 对象一定存在。
- 不直接读取 route context。

## 为什么需要 route 调用点

route 进入后，Hono context 可以拿到最新 runtime env：

```ts
c.env;
```

在 Cloudflare Workers 中，启用 Node.js compatibility 后，`process.env` 可以承载字符串 env 和 secrets。但 KV、R2、D1、Durable Object 等 bindings 仍然是对象能力，来自 request-bound `c.env`。

因此 route 阶段需要合并：

```ts
const runtimeEnv = getEnvProvider(envConfig, { merge: true });
c.set("runtimeEnv", runtimeEnv);
```

route 调用点的职责：

1. 获取最新 `c.env` 或 `process.env`。
2. 合并 bootstrap 阶段保存的 raw env。
3. 补齐 Cloudflare bindings。
4. 重新执行 runtime config 校验。
5. 将已校验 env 注入 Hono context。

这样业务代码可以统一写：

```ts
const runtimeEnv = c.get("runtimeEnv");
```

而不是在业务层判断该读取 `process.env` 还是 `c.env`。

## Provider 生命周期

env provider 入口是：

```ts
getEnvProvider(process.env);
getEnvProvider(latestEnv, { merge: true });
getEnvProvider(latestEnv, { override: true });
```

语义：

- `getEnvProvider(process.env)`: bootstrap 阶段使用，保存并校验启动期 env。
- `getEnvProvider(latestEnv, { merge: true })`: route 阶段使用，将最新 env 合并到 bootstrap raw env 后重新校验。
- `getEnvProvider(latestEnv, { override: true })`: 强制使用传入 env 替换 provider raw env。

provider 内部维护：

```ts
let envProviderRawEnv: Record<string, unknown> | undefined;
```

这不是业务缓存，而是为了支持 bootstrap env 与 route env 合并。provider 对外只返回已经校验过的 `RuntimeConfig`。

provider disposer 会：

1. 删除 provider map 中的 `env`。
2. 删除 provider disposer。
3. 清空 raw env 快照。

## Runtime Schema 分发

env 的统一入口是：

```ts
getRuntimeConfig(rawEnv);
```

内部流程：

```txt
normalizeEnv(rawEnv)
  -> parse APP_RUNTIME
  -> APP_RUNTIME=cloudflare ? parseIsolateConfig : parseProcessConfig
```

`APP_RUNTIME` 是事实型配置。项目不创建 `APP_RUNTIME_MODE`，因为 mode 可以从 `APP_RUNTIME` 推导。

## Isolate Env

isolate env 使用：

```ts
parseIsolateConfig(env);
```

特点：

- 适合 Cloudflare Workers、Vercel Edge 等 isolate runtime。
- 包含 request-bound binding 校验。
- 当前 Cloudflare 配置会校验 `sofary` KV namespace。
- 字符串 env 可以来自 bootstrap `process.env`。
- binding 对象需要 route 阶段从 `c.env` 合并。

isolate env 不应该假设所有能力都能在启动期从 `process.env` 获得。

## Process Env

process env 使用：

```ts
parseProcessConfig(env);
```

特点：

- 适合 Node、Bun、VPS、容器等 process runtime。
- 完整 env 可以在 bootstrap 阶段从 `process.env` 获取。
- 更适合启动期全量校验。

process-only 代码可以使用：

```ts
import { env } from "@/infra/env/validated";
```

但这个入口不应该用于 isolate request-bound 代码。

## normalizeEnv

`normalizeEnv` 将未知 env 输入转换为普通对象，并对字符串值执行 `decodeURIComponent`。

它的目的：

- 统一 `process.env`、`c.env`、测试对象等不同输入。
- 保持 schema parser 只处理 `Record<string, unknown>`。
- 避免配置层散落重复转换逻辑。

## Error Handling

env 解析失败会抛出格式化后的 project-level error。route 阶段由 `runtimeEnvMiddleware` 捕获并转成统一异常：

```ts
throw internalServerError("runtime env errors", {
  details: { cause: error, message },
  expose: true,
});
```

这样 env 错误也会进入统一 exceptions 流程。

## 设计规则

1. 业务代码不直接解析 `process.env` 或 `c.env`。
2. bootstrap 阶段使用 `getEnvProvider(process.env)`。
3. route 阶段使用 `getEnvProvider(latestEnv, { merge: true })`。
4. Cloudflare bindings 通过 route 阶段合并。
5. `APP_RUNTIME` 描述事实，执行模型由 env 入口分发。
6. `isolate.ts` 只放 isolate schema 和 binding 校验。
7. `process.ts` 只放 process schema。
8. `validated.ts` 只用于 process-only 场景。
