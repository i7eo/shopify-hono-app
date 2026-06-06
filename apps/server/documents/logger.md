# Logger Design

本文说明服务端 logger 的设计边界。logger 既要能在 app 启动时使用，也要能在 route 进入后根据 runtime env 切换到正确配置，因此它有两个调用点：bootstrap 和 route。

## 目标

logger 设计只做四件事：

1. 启动期提供可用的兜底日志。
2. route 进入后根据已校验 runtime env 切换到 runtime logger。
3. 根据 isolate / process 执行模型选择不同 sink。
4. 通过 provider 统一管理实例、reset 和 dispose。

业务代码不直接初始化 logger，也不直接配置 LogTape。业务只从 Hono context 或 provider 中获取 logger。

## 为什么需要 bootstrap 调用点

app startup 阶段还没有 Hono route context。此时可能还没有：

- `c.env`
- Cloudflare bindings

但启动阶段仍然需要记录日志，例如：

- app startup 成功或失败。
- bootstrap env 校验结果。
- process exception handler 注册。
- 模块初始化错误。

因此 bootstrap 阶段调用：

```ts
const logger = await getLoggerProvider();
logger.info("Both logger and env are initialized.");
```

此时 `getLoggerProvider()` 不传 runtime config，内部会调用：

```ts
setupBootstrapLogger();
```

bootstrap logger 的原则：

- console-only。
- 不依赖 route。
- 不依赖 Cloudflare bindings。
- 不触碰文件系统。
- 只保证启动期有日志可用。

## 为什么需要 route 调用点

route 进入后，runtime middleware 可以拿到最新 env：

```ts
const runtimeEnv = c.get("runtimeEnv");
```

这时 logger 可以根据完整 runtime config 切换：

```ts
const runtimeLogger = await getLoggerProvider(runtimeEnv);
c.set("runtimeLogger", runtimeLogger);
```

route 调用点的职责：

1. 从 bootstrap logger 切换到 runtime logger。
2. 根据 `APP_RUNTIME` 选择 isolate/process 配置。
3. 将 logger 注入 Hono context。
4. 让 route、middleware、exception handler 使用统一 logger。

这样业务代码可以统一写：

```ts
const logger = c.get("runtimeLogger");
```

而不是在业务层 import 全局 logger。

## Provider 生命周期

logger provider 只有一个入口：

```ts
getLoggerProvider();
getLoggerProvider(runtimeEnv);
getLoggerProvider(runtimeEnv, { override: true });
```

语义：

- `getLoggerProvider()`: bootstrap 阶段使用，初始化 console-only logger。
- `getLoggerProvider(runtimeEnv)`: route 阶段使用，如果当前还不是 runtime phase，则 reset logger 配置。
- `getLoggerProvider(runtimeEnv, { override: true })`: 动态配置刷新时强制 reset。

provider 内部维护阶段：

```ts
type LoggerProviderPhase = "bootstrap" | "runtime";
```

这不是缓存业务数据，只是 logger 生命周期状态。它保证普通请求不会每次重复执行 LogTape reset。

provider disposer 会：

1. 调用 LogTape `dispose()`。
2. 删除 provider map 中的 `logger`。
3. 删除 provider disposer。
4. 重置 logger phase。

## Logger 实例与 LogTape 配置

项目中 logger 对象来自：

```ts
const logger = getLogger([name]);
```

这个 logger 对象可以稳定复用。bootstrap 到 runtime 的切换不是创建很多不同 logger，而是通过：

```ts
configure({
  reset: true,
  // ...
});
```

覆盖 LogTape 全局 sink 和 logger 配置。

因此 provider 中保存的是同一个 logger facade，变化的是 LogTape 配置。

## Isolate Logger

isolate runtime 使用：

```ts
setupIsolateLogger(runtimeEnv, options);
```

特点：

- console-only。
- 不写本地文件。
- 不动态引入 `node:*`。
- 适合 Cloudflare Workers、Vercel Edge 等 isolate runtime。

即使 Cloudflare Workers 支持 `process.env` 或部分 virtual file system，也不把它当作持久日志文件系统。日志应交给 console/platform logging。

## Process Logger

process runtime 使用：

```ts
setupProcessLogger(runtimeEnv, options);
```

特点：

- 非 production 使用 console-only。
- production 可以写文件。
- 文件能力只在 process 文件中动态引入。
- 支持 size rotating file sink 和 daily rotating file sink。

process logger 可以使用：

- `node:fs/promises`
- `node:path`
- `node:url`
- `@logtape/file`

这些能力不会出现在 isolate logger 的启动路径中。

## Sink 策略

公共 console logger 来自：

```ts
setupConsoleLogger(level, options);
```

使用场景：

- bootstrap logger。
- isolate runtime logger。
- non-production process logger。

process production logger 根据配置选择：

- `APP_LOGGER_MAX_SIZE`: 启用 size rotating files。
- `APP_LOGGER_EXPIRE`: 启用 daily rotating files。
- 两者都没有设置时，使用默认 daily rotation。

日志文件位置由 `APP_LOGGER_DIR` 决定。

## Error Lifecycle 中的 logger

`app/lifecycle/error.ts` 优先使用 request context 中的 runtime logger：

```ts
const logger = getContextValue(c, "runtimeLogger");
```

如果错误发生在 route logger 注入之前，则动态引入 bootstrap logger：

```ts
const logger = (await import("@/infra/logger")).default;
```

这保证错误处理在两个阶段都能记录日志：

- request 前或 middleware 早期错误: 使用 bootstrap logger。
- route/runtime 阶段错误: 使用 `runtimeLogger`。

## 设计规则

1. logger provider 只暴露 `getLoggerProvider` 一个入口。
2. bootstrap 调用不传 runtime config。
3. route 调用传入已校验 runtime env。
4. 普通请求不传 `override`，避免每次 request reset LogTape。
5. 动态配置刷新才使用 `{ override: true }`。
6. isolate logger 不写文件。
7. process-only 文件能力只放在 `process.ts`。
8. 业务代码优先使用 `c.get("runtimeLogger")`，不要到处 import logger。
