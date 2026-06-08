# Runtime Design

本文说明服务端 runtime 的设计边界。项目只要求用户配置事实型环境变量，例如 `APP_RUNTIME=cloudflare` 或 `APP_RUNTIME=node`，不额外创建 `APP_RUNTIME_MODE`。执行模型由代码根据 `APP_RUNTIME` 推导，并用文件命名表达。

## 目标

runtime 设计只做三件事：

1. 用 `APP_RUNTIME` 描述当前部署平台或运行时事实。
2. 用 `isolate` / `process` 文件边界表达执行模型。
3. 业务代码通过统一 provider 和 middleware 获取 runtime 能力，不直接关心 env 来源差异。

这样可以避免出现不一致配置，例如：

```txt
APP_RUNTIME=cloudflare
APP_RUNTIME_MODE=process
```

`APP_RUNTIME_MODE` 是派生值，不应该由用户重复配置。

## Runtime 分类

项目内部把 runtime 分成两类：

- `isolate`: Cloudflare Workers、Vercel Edge、Deno Deploy 等 V8 isolate / edge 模型。
- `process`: Node、Bun、VPS、容器、PM2、systemd 等进程模型。

当前项目中：

```txt
cloudflare -> isolate
node       -> process
```

后续如果支持更多平台，只需要扩展分类逻辑：

```txt
vercel-edge -> isolate
vercel-node -> process
bun         -> process
```

## 文件边界

runtime 相关能力使用文件命名表达执行模型：

```txt
infra/env/
  index.ts
  isolate.ts
  process.ts
  shared.ts

infra/logger/
  index.ts
  isolate.ts
  process.ts
  shared.ts
```

约定：

- `index.ts`: 统一入口，读取 `APP_RUNTIME` 并分发。
- `isolate.ts`: 只放 isolate runtime 能力。
- `process.ts`: 只放 process runtime 能力。
- `shared.ts`: 两类 runtime 都能安全使用的公共逻辑。

业务层不直接 import `isolate.ts` 或 `process.ts`。业务只使用统一入口或 provider。

## Env 来源

项目启动时会把完整字符串 env 注入到进程中，因此 bootstrap 阶段可以读取：

```ts
process.env;
```

在 Cloudflare Workers 中，启用 Node.js compatibility 后，`process.env` 可以承载字符串环境变量和 secrets。但是 Cloudflare bindings 不是字符串 env，例如 KV、R2、D1、Durable Object binding，它们仍然来自 request 级别的 `c.env`。

因此 env provider 采用两阶段合并：

```txt
bootstrap:
  getEnvProvider(process.env)

route:
  getEnvProvider(c.env 或 process.env, { merge: true })
```

含义：

- bootstrap 阶段先校验并保存进程注入的字符串 env。
- route 阶段获取最新 env，并合并 Cloudflare bindings。
- 合并后重新执行 runtime config 校验。

## Isolate Runtime

isolate runtime 的特点：

- 没有传统持久进程磁盘模型。
- env/bindings 可能来自 request context。
- 即使支持 `process.env`，KV/R2/D1 这类 binding 仍然需要从 `c.env` 合并。
- logger 不写本地文件，只使用 console sink。

isolate 文件中可以做：

- 校验 Cloudflare binding 是否存在。
- 使用 console logger。
- 使用 Web API。

isolate 文件中不应该做：

- 假设持久文件系统。
- 使用 Node-only 文件写入作为核心能力。
- 在没有 request context 时要求 binding 对象一定存在。

## Process Runtime

process runtime 的特点：

- 可以使用 `process.env`。
- 可以使用 Node/Bun 进程能力。
- production 下可以使用文件系统写日志。
- 更适合启动期完整校验。

process 文件中可以做：

- 读取 `process.env`。
- 动态引入 `node:*` 模块。
- 使用 `@logtape/file` 写日志文件。

process 文件中不应该影响 isolate bundle 的启动路径。Node-only 能力需要放在 process 文件里，并尽量动态引入。

## Provider 统一入口

runtime 相关实例统一放入 provider：

```txt
infra/provider/
  env
  logger
  ...
```

当前约定：

- `getEnvProvider(process.env)`: bootstrap 阶段初始化 env。
- `getEnvProvider(latestEnv, { merge: true })`: route 阶段合并最新 env。
- `getLoggerProvider()`: bootstrap 阶段初始化 bootstrap logger。
- `getLoggerProvider(runtimeEnv)`: route 阶段按 runtime env 切换 logger。

这样 provider 成为全局实例集合，方便 shutdown、dispose、测试重置和后续扩展 OpenAI、cache、database 等 provider。

## 设计规则

1. 不创建 `APP_RUNTIME_MODE`。
2. `APP_RUNTIME` 描述事实，执行模型由代码推导。
3. 文件命名使用 `isolate` / `process` 表达能力边界。
4. 业务代码不直接判断 `isolate` / `process`，只通过 provider 或统一入口获取能力。
5. isolate 不依赖持久文件系统。
6. process-only 能力放入 `process.ts` 并动态引入。
7. Cloudflare bindings 仍通过 route 阶段 `c.env` 合并进 provider。

## Isolate 中需要避免的 Node 能力

Cloudflare Workers、Vercel Edge、Deno Deploy 等 V8 isolate runtime 更接近 Web Worker 执行模型，而不是传统 Node 进程模型。Cloudflare 可以通过 `nodejs_compat` 兼容一部分 Node API，但为了保持跨 isolate 平台可移植，项目默认不把 Node API 当成 isolate 基础能力。

| 类别                    | 避免内容                                                     | 推荐替代                                        |
| ----------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| 本地文件系统            | `node:fs`、`node:fs/promises`、依赖 `process.cwd()` 读写磁盘 | KV、R2、Blob、平台 storage                      |
| Node HTTP server        | `http.createServer`、`@hono/node-server`、`server.listen()`  | Worker module entry: `export default { fetch }` |
| 进程生命周期            | `process.on`、`process.exit`、signals、graceful shutdown     | 平台 lifecycle、`ctx.waitUntil()`               |
| OS 信息                 | `node:os`、`networkInterfaces()`                             | 不依赖本机网络信息                              |
| 子进程/线程             | `child_process`、`cluster`、`worker_threads`                 | Queues、Workflows、外部服务                     |
| TCP/TLS 原始连接        | `node:net`、`node:tls`、许多原生数据库 driver                | HTTP API、平台数据库 binding                    |
| Node streams            | `node:stream`                                                | Web Streams                                     |
| CommonJS/runtime loader | `require`、`module`、`__dirname`、`__filename`               | ESM、静态 import、构建期解析                    |
| 动态代码执行            | `eval`、`new Function`、动态 Wasm 编译                       | 构建期生成、静态模块                            |
| Node env                | 模块顶层或请求外强依赖 `process.env`                         | Cloudflare `env` binding、平台 env 注入         |
| Buffer/Crypto           | 强依赖 `Buffer`、`node:crypto`                               | `Uint8Array`、Web Crypto                        |

判断标准：

- 如果能力依赖“一个长期存在的本机进程”，它通常属于 `process`。
- 如果能力可以用 Fetch/Web API 表达，它更适合放在 `shared` 或 `isolate`。
- 如果能力只在 Node 中有意义，应放入 Node runtime adapter，不能被 Cloudflare/Vercel entry 静态导入。

## 当前项目中的 Node 能力点

当前项目允许 Node-only 文件存在，但它们必须只从 Node entry 或 Node runtime adapter 进入 import graph。Cloudflare/Vercel isolate entry 不应该 import 这些文件。

### 已隔离的 Node-only 文件

这些文件属于 `process` runtime，不能被 isolate entry 导入：

- `apps/server/src/node.ts`
  - Node entry。
  - 使用 `@hono/node-server` 启动 Hono app。
- `apps/server/src/app/bootstrap/register-process-exceptions.ts`
  - 使用 `process.on`、`process.exit` 注册进程异常处理。
- `apps/server/src/app/bootstrap/register-process-exits.ts`
  - 注册进程退出和 graceful shutdown。
- `apps/server/src/infra/logger/process.ts`
  - 动态引入 `node:fs/promises`、`node:path`、`node:url` 和 `@logtape/file`。
  - 只用于 process runtime 的文件日志能力。
- `apps/server/src/app/modules/health/disk.node.ts`
  - 使用 `node:fs`、`node:fs/promises` 做磁盘健康检查。
- `apps/server/src/utils/net.ts`
  - 使用 `node:os` 获取本机网卡信息。
  - 不应该从 `apps/server/src/utils/index.ts` 这类 barrel 文件 re-export，否则普通工具 import 也会把 `node:os` 带进 bundle。

### 共享代码中的 isolate 风险点

这些代码目前有防护或受运行路径约束，但维护时需要继续留意：

- `apps/server/src/shared/middlewares/runtime-env.ts`
  - 当前逻辑会根据 `c.env.APP_RUNTIME` 选择 `c.env` 或 `process.env`。
  - 风险：如果 isolate runtime 没有注入 `APP_RUNTIME` binding，可能走到 `process.env` fallback。
  - 建议：isolate entry 应确保 `APP_RUNTIME=cloudflare` 存在于 binding/env 中；需要更通用的 Edge 支持时，fallback 应写成 `typeof process !== "undefined" ? process.env : {}`。
- `apps/server/src/app/modules/health/service.ts`
  - `checkMemoryHealth` 使用 `typeof process !== "undefined"` 和 `typeof process.memoryUsage === "function"` 做保护。
  - isolate 下返回 `unsupported`，这是可接受行为。
- `apps/server/src/app/modules/health/constants.ts`
- `apps/server/src/app/modules/shopify/constants.ts`
  - 使用 `typeof process !== "undefined"` 读取可选的 `process.env.APP_GLOBAL_PREFIX`。
  - 当前写法不会在 isolate 中直接报错。
  - 更纯粹的 isolate 设计是 route path 使用稳定常量或构建时配置，不在模块顶层依赖 runtime env。

### 非运行时代码

这些文件使用 Node API 是正常的，因为它们属于构建、测试或脚本，不进入 Worker runtime：

- `scripts/write-shopify-file/*`
- `apps/server/build.config.ts`
- `apps/server/vitest.config.ts`
- `apps/server/tests/*`
- `packages/*/build.config.ts`

## Entry 边界

项目应保持不同 runtime 使用不同 entry：

```txt
apps/server/src/cloudflare.ts -> isolate / Cloudflare Worker entry
apps/server/src/node.ts       -> process / Node entry
```

Cloudflare entry 只应该导入跨 runtime 安全的 app factory，例如 `bootstrapApp`，并导出 fetch handler：

```ts
export default {
  async fetch(request, env, ctx) {
    const app = await bootstrapApp({ runStartup: false });
    return app.fetch(request, env, ctx);
  },
};
```

Node entry 可以导入 Node-only 能力，例如：

```ts
import { serve } from "@hono/node-server";
import { setupProcessLogger } from "@/infra/logger/process";
import { checkProcessDiskAccess } from "@/app/modules/health/disk.node";
```

这个边界比在同一个 entry 中写 runtime 条件判断更稳。原因是 Worker bundler 会静态扫描 import graph；即使某个 `import()` 只在 Node 分支运行，只要它对 isolate entry 可见，也可能触发 Node built-in warning 或构建失败。

## 推荐的 Node Runtime Adapter

为了避免 `src/node.ts` 直接散落多种注册逻辑，推荐把 Node-only 能力统一收敛到：

```txt
apps/server/src/app/runtimes/node/index.ts
```

推荐形态：

```ts
export function registerNodeRuntimeCapabilities() {
  registerProcessLoggerSetup(setupProcessLogger);
  registerProcessDiskHealthChecker(checkProcessDiskAccess);
}
```

更进一步，可以让 Node adapter 负责完整启动：

```ts
export async function startNodeRuntime() {
  registerNodeRuntimeCapabilities();

  await registerProcessExceptions();

  const app = await bootstrapApp();
  const nodeApp = serve(app);

  const logger = await getLoggerProvider();
  logger.info("Server is running. OpenAPI Route: /reference");

  await registerProcessExits(nodeApp);
}
```

此时 `src/node.ts` 只需要：

```ts
import { startNodeRuntime } from "@/app/runtimes/node";

void startNodeRuntime();
```

这样公共 app 不知道 Node 怎么启动，Cloudflare/Vercel entry 不知道 Node-only 文件存在，Node runtime 统一接线。

## Node-only Runtime 注入模型

Node-only runtime 注入可以理解成：

```txt
共享代码只预留插座。
Node entry 启动时把 Node-only 插头插上。
Cloudflare/Vercel entry 不插这个插头，也不 import Node-only 文件。
```

推荐新增一个跨 runtime 安全的 capability registry：

```txt
apps/server/src/app/runtimes/capabilities.ts
```

它只保存函数引用，不 import `node:*`、`@hono/node-server`、`@logtape/file` 等 Node-only 依赖：

```ts
type DiskHealthChecker = () => Promise<string>;

type RuntimeCapabilities = {
  processDiskHealthChecker: DiskHealthChecker;
};

const capabilities = new Map<keyof RuntimeCapabilities, unknown>();

export function setRuntimeCapability<K extends keyof RuntimeCapabilities>(
  key: K,
  value: RuntimeCapabilities[K],
) {
  capabilities.set(key, value);
}

export function getRuntimeCapability<K extends keyof RuntimeCapabilities>(
  key: K,
): RuntimeCapabilities[K] | undefined {
  return capabilities.get(key) as RuntimeCapabilities[K] | undefined;
}
```

真正使用 Node API 的实现放在 Node-only 文件中：

```ts
// apps/server/src/app/runtimes/node/disk.ts
import { constants } from "node:fs";
import { access } from "node:fs/promises";

export async function checkProcessDiskAccess() {
  const path = process.cwd();
  await access(path, constants.R_OK | constants.W_OK);
  return path;
}
```

Node runtime adapter 在启动时注入能力：

```ts
// apps/server/src/app/runtimes/node/index.ts
import { setRuntimeCapability } from "../capabilities";
import { checkProcessDiskAccess } from "./disk";

export function registerNodeRuntimeCapabilities() {
  setRuntimeCapability("processDiskHealthChecker", checkProcessDiskAccess);
}
```

Node entry 调用 adapter：

```ts
// apps/server/src/node.ts
import { registerNodeRuntimeCapabilities } from "@/app/runtimes/node";

registerNodeRuntimeCapabilities();
```

共享业务代码只从 registry 取能力，不直接 import Node-only 文件：

```ts
// apps/server/src/app/modules/health/service.ts
import { getRuntimeCapability } from "@/app/runtimes/capabilities";

export async function checkDiskHealth(runtimeConfig: RuntimeConfig) {
  if (runtimeConfig.APP_RUNTIME !== "node") {
    return { status: "unsupported", target: "disk" };
  }

  const checker = getRuntimeCapability("processDiskHealthChecker");
  if (!checker) {
    return { status: "unsupported", target: "disk" };
  }

  const path = await checker();
  return { status: "ok", target: "disk", path };
}
```

logger 也是同样模型：

```ts
type RuntimeCapabilities = {
  processLoggerSetup: (
    config: RuntimeConfig,
    options: LoggerSetupOptions,
  ) => Promise<void>;
};
```

```ts
// apps/server/src/app/runtimes/node/index.ts
import { setupProcessLogger } from "@/infra/logger/process";

setRuntimeCapability("processLoggerSetup", setupProcessLogger);
```

```ts
// apps/server/src/infra/logger/index.ts
const setup = getRuntimeCapability("processLoggerSetup");

if (runtimeConfig.APP_RUNTIME === "node" && setup) {
  await setup(runtimeConfig, { reset });
} else {
  await setupConsoleLogger(runtimeConfig.APP_LOGGER_LEVEL, { reset });
}
```

核心规则：

```txt
共享代码 import capabilities registry。
Node entry import Node-only implementation。
Cloudflare/Vercel entry 不 import Node adapter。
```

这样 `infra/logger/index.ts` 不直接 import `infra/logger/process.ts`，Cloudflare bundle 就看不到 `@logtape/file`、`node:fs` 等 Node-only 依赖。

## Runtime 判断与 Capability 注入的取舍

`if (isIsolateRuntime(runtime))` 和 capability 注入解决的是不同层级的问题：

```txt
runtime 判断:
  运行时分支。

capability 注入:
  构建期 import graph 隔离 + 运行时能力分发。
```

### 直接 runtime 判断

优点：

- 直观，代码少。
- 适合纯 Web API 或纯业务逻辑分支。
- 当两个分支都没有 Node-only import 时很好用。
- 类型和调用链比较直接。

缺点：

- bundler 仍然可能静态扫描两个分支里的 import。
- 即使 Node 分支运行时不会执行，只要 isolate entry 能看到 `import("@hono/node-server")`、`import("@logtape/file")`、`import("node:fs")`，就可能产生 warning 或 build failure。
- shared 文件容易慢慢变成“什么 runtime 都知道一点”，边界会变模糊。
- 适配 Vercel Edge 这类更严格的 isolate 时风险更高。

适合使用 runtime 判断的例子：

```ts
if (isIsolateRuntime(runtime)) {
  return { status: "unsupported" };
}
```

或者两个分支都只使用 Web API：

```ts
if (isIsolateRuntime(runtime)) {
  return crypto.subtle.digest("SHA-256", data);
}
```

### Capability 注入

优点：

- isolate entry 的 import graph 完全看不到 Node-only 文件。
- Node-only 能力集中在 `app/runtimes/node`，边界清楚。
- shared service 只依赖抽象能力，不依赖平台实现。
- 后续增加 `vercel-edge`、`bun`、`node` adapter 更自然。
- 能避免用 `nodejs_compat` 兜底式修补架构边界。

缺点：

- 多一层抽象，初看绕一点。
- 需要维护 registry key 和类型。
- 如果能力很少，可能显得过度设计。
- runtime 未注册能力时需要 fallback 或明确错误。

适合使用 capability 注入的情况：

```txt
node:fs
node:os
@hono/node-server
@logtape/file
process.on / process.exit
server.listen
```

实用规则：

```txt
判断 runtime 行为差异 -> 用 if
隔离 runtime-only 依赖 -> 用 adapter / capability 注入
```

放到当前项目里：

- `parseRuntimeConfig` 用 `APP_RUNTIME` 分发 schema: 适合 runtime 判断。
- `checkMemoryHealth` 用 `typeof process !== "undefined"`: 可以接受。
- `setupLogger` 如果要接入 `@logtape/file`: 适合 capability 注入。
- `checkDiskHealth` 如果要接入 `node:fs`: 适合 capability 注入。
- `@hono/node-server`: 必须只在 Node entry 或 Node adapter 中出现。

## 当前验证方式

检查 isolate bundle 是否被 Node-only 能力污染：

```bash
cd apps/server
node --env-file=../../.env.development ./node_modules/wrangler/bin/wrangler.js deploy --dry-run
```

预期：

- dry-run 成功。
- 不出现 `node:fs`、`node:http`、`node:os`、`@hono/node-server`、`@logtape/file` 等进入 Worker bundle 的 warning。

当前开发沙箱可能会出现 Wrangler 写日志文件的 `EPERM`：

```txt
Failed to write to log file ... /Library/Preferences/.wrangler/logs/...
```

如果命令退出码为 `0`，且 dry-run 输出了 upload/bindings 信息，这个 `EPERM` 只是沙箱文件权限问题，不代表 Worker 构建失败。

## 参考资料

- Cloudflare Node.js compatibility: https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Cloudflare Module Workers: https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
- Vercel Edge Runtime: https://vercel.com/docs/functions/runtimes/edge/edge-functions.rsc
