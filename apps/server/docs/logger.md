# Logger Design

本文说明服务端 logger 的生命周期和 runtime sink 策略。业务代码不直接初始化 LogTape，优先使用请求上下文中的 `runtimeLogger`。

## 两个阶段

### Bootstrap Logger

启动阶段还没有 Hono context，也不一定有 Cloudflare binding，因此 bootstrap logger 必须简单可靠：

- console-only
- 不依赖文件系统
- 不依赖 request context
- 不读取平台 binding

入口：

```ts
await getLoggerProvider();
```

对应代码：

- `src/infra/provider/logger.ts`
- `src/infra/logger/index.ts`

### Runtime Logger

请求进入后，`runtimeLoggerMiddleware` 使用已校验的 `runtimeEnv` 配置 runtime logger：

```ts
const runtimeLogger = await getLoggerProvider(runtimeEnv);
c.set("runtimeLogger", runtimeLogger);
```

业务代码和 middleware 能拿到 `c` 时，优先使用：

```ts
const logger = c.get("runtimeLogger");
```

## Provider 行为

logger provider 使用阶段标记避免普通请求反复 reset LogTape：

- `bootstrap`: 已配置启动期 logger。
- `runtime`: 已配置 runtime logger。

只有以下情况会重新配置：

- 从 bootstrap 阶段切到 runtime 阶段。
- 显式传入 `{ override: true }`。
- provider 被 reset 或 dispose 后重新初始化。

## Runtime Sink

| Runtime             | Sink 策略                     |
| ------------------- | ----------------------------- |
| Cloudflare isolate  | console-only                  |
| Node non-production | console-only                  |
| Node production     | console + rotating file sinks |

Node production 文件日志只在 process logger 中动态引入 Node-only 依赖：

- `node:fs/promises`
- `node:path`
- `node:url`
- `@logtape/file`

这些依赖不会出现在 Cloudflare isolate entry 的静态 import graph 中。

对应文件：

- `src/infra/logger/shared.ts`
- `src/infra/logger/isolate.ts`
- `src/infra/logger/process.ts`
- `src/app/runtime/process/capabilities.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`

## Error Lifecycle

全局错误处理优先使用请求上下文中的 logger：

```ts
const logger = getContextValue(c, "runtimeLogger");
```

如果错误发生在 runtime logger 注入之前，会动态引入默认 logger 作为兜底。错误响应规则见 [error.md](./error.md)。

## 规则

1. 业务代码不要直接调用 LogTape `configure()`。
2. 有 Hono context 时优先使用 `c.get("runtimeLogger")`。
3. 没有 context 的启动期代码使用 `getLoggerProvider()`。
4. Cloudflare/isolate 不写本地日志文件。
5. Node-only 文件日志能力只放在 process logger 和 process capability 中。
