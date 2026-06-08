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
