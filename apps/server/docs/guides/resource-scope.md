# Resource Scope（请求/任务级资源生命周期）

本文记录「每请求/每任务解析资源、结束后统一处置」的设计与实现。它是架构 guide，不是接口 reference。与 [runtime-infra-entrypoints.md](./runtime-infra-entrypoints.md) 配套：后者讲 infra 工厂怎么按 runtime 分发，本文讲这些工厂产出的资源怎么在一次请求/任务内被复用与释放。

## 背景

infra 资源在两类 runtime 下生命周期相反：

| Runtime            | 连接形态                                    | 释放时机         |
| ------------------ | ------------------------------------------- | ---------------- |
| Node process       | `pg.Pool` 等**跨请求共享单例**              | 应用关闭时       |
| Cloudflare isolate | 每请求 `new Client()+connect()` 的真 socket | **每请求结束时** |

isolate 下若不在请求结束时 `client.end()`，连接会堆积、耗尽 Hyperdrive 槽位。但业务层（route/service）是**两 runtime 共享**的同一份代码，不能写 `if (isolate) … else …`。

因此需要一个**运行时无关**的抽象：业务层只声明「我要一个 database」，由统一机制负责「同请求内复用、结束后处置」，而 isolate 真关、process 空转。

## 核心抽象：ResourceScope

```text
apps/server/src/app/runtime/resources/scope.ts
```

```ts
interface ResourceScope {
  // 按 key memo:同一 scope 内同 key 复用一个实例,首次解析时登记 disposer
  resolve: <T>(
    key: string,
    factory: () => T | Promise<T>,
    dispose?: (r: T) => unknown,
  ) => Promise<T>;
  // 非 memo:登记一次性清理(如 multipart abort、stream cancel)
  add: (disposer: () => unknown) => void;
  // LIFO、错误隔离、失败记日志、幂等
  dispose: () => Promise<void>;
}
```

- `resolve` 是**框架无关**的：它只认 `key`/`factory`/`dispose`，不知道 DB、不知道 Hono。
- `dispose` 失败只 `logger.error` 不抛，保证一个 disposer 出错不连累其余。

`resources/` 目录只放框架无关或上下文适配件：

```text
apps/server/src/app/runtime/resources/scope.ts     # ResourceScope（纯）
apps/server/src/app/runtime/resources/context.ts   # RuntimeResourceContext + Hono 适配
apps/server/src/app/runtime/resources/index.ts
```

## 生命周期：谁建、谁销

scope 由**入口边界**创建并在边界结束时处置，业务层只消费 `context` 上挂的 scope：

| 入口       | 创建/处置位置                                                       | 挂载点                                         |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| HTTP 请求  | `shared/middlewares/resource-scope.ts`（`resourceScopeMiddleware`） | `c.get("resources")`                           |
| Queue 消息 | `infra/queue/consumer.ts`（`withJobScope`，每条消息一个）           | `context.resources`（`QueueJobScopedContext`） |

HTTP 中间件挂在 `runtimeLoggerMiddleware` **之后**（这样处置失败能用 `runtimeLogger` 记录），见 `app/bootstrap/register-middleware.ts`：

```ts
app.use("*", resourceScopeMiddleware());
// 内部:
const scope = createResourceScope(c.get("runtimeLogger"));
c.set("resources", scope);
try {
  await next();
} finally {
  await scope.dispose();
}
```

> Queue 侧：`consumer.ts` 为**每条消息**建一个 scope，并把它合进 `QueueJobScopedContext` 透传给 handler；`jobs.ts` 里 `createServiceContext` 会把同一个 scope 暴露为 `get("resources")`，让被复用的 HTTP service 共享同一条任务级连接。

## 调用约定

业务层**直接用原语**，不包 DB 专用薄封装：

```ts
const database = c.get("resources").resolve(
  "database",
  () =>
    requireCapability("databaseFactory")(
      createRuntimeResourceContextFromHono(c),
    ),
  (db) => db.dispose(),
);
```

三个零件各司其职：

| 零件                                      | 来源                                  | 作用                                                          |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `resolve("database", …)`                  | `c.get("resources")`（ResourceScope） | 按 key memo + 登记处置                                        |
| `requireCapability("databaseFactory")`    | `app/runtime/capabilities.ts`         | 取注册的工厂，缺失即抛（`getRuntimeCapability` 的抛错版孪生） |
| `createRuntimeResourceContextFromHono(c)` | `app/runtime/resources/context.ts`    | Hono context → 框架无关 `{ bindings, runtimeEnv }`            |

key 用字符串字面量 `"database"`，不引入常量表。代价：拼错会静默生成另一条缓存项；当前只有一个 key，可接受。资源种类变多时再考虑收回常量约束。

## 平台无关性（为何这样设计）

两个刻意的「去 Cloudflare 化」决策，保证可平移到 Node / Vercel：

1. **不用 `executionCtx.waitUntil`**：中间件 `finally` 里直接 `await scope.dispose()`。`client.end()` 亚毫秒级，加在响应返回前可忽略，且三种 runtime 行为一致。
2. **不靠 `APP_RUNTIME` 嗅探决定该不该关**：让 process 工厂返回带 **noop `dispose`** 的每请求视图（见 `app/runtime/process/capabilities.ts`），真正的 `pool.end()` 仍由应用关闭时的 `disposeProcessDatabase()` 负责。于是 `resolve`/`dispose` 一律无条件执行——isolate 真关、process 空转，**全链路零 runtime 分支**。

各 provider 的 `dispose` 语义：

| 资源                           | `dispose` 行为                | 文件                                                   |
| ------------------------------ | ----------------------------- | ------------------------------------------------------ |
| isolate Postgres（Hyperdrive） | `client.end()`（真关 socket） | `infra/database/isolate.ts`                            |
| isolate D1 / process（任意）   | noop（无 socket / 共享单例）  | `infra/database/isolate.ts`、`process/capabilities.ts` |

## 约束

HTTP handler **不得返回「由请求数据库连接支撑的流式响应体」**。因为 `dispose` 在 handler 返回后立即执行，会在流读完前关掉连接。本项目下载走 bucket（R2/S3），JSON 响应在返回时已与 DB 脱钩——安全。新增流式路由时需复核此点。

## 新增「每请求资源」的规则

要把一个新资源（如 Redis、第二个 DB）纳入请求级生命周期：

1. 让它的工厂走 capability 注册（见 [runtime-infra-entrypoints.md](./runtime-infra-entrypoints.md)），isolate 实现返回真 `dispose`，process 实现返回 noop `dispose` 视图。
2. 业务层用原语解析：

   ```ts
   const redis = c.get("resources").resolve(
     "redis",
     () =>
       requireCapability("redisFactory")(
         createRuntimeResourceContextFromHono(c),
       ),
     (client) => client.quit(),
   );
   ```

3. 就地一次性清理（不需要 memo）用 `scope.add(() => …)`，例如 multipart 上传 abort、stream reader cancel。

不要在 service/controller/queue job 里手写 `if (isCloudflareRuntime) …` 来决定开/关。

## 检查项

修改资源生命周期后至少检查：

```bash
# 业务层不应出现 runtime 分支式的资源开关
rg "isCloudflareRuntime|APP_RUNTIME ===" apps/server/src/app/modules
# 处置入口仍在边界(中间件 + 队列消费者),不应散落到 service
rg "createResourceScope|\.dispose\(\)" apps/server/src/app apps/server/src/shared apps/server/src/infra/queue

pnpm --dir apps/server test
pnpm --dir apps/server run cf:build
pnpm --dir apps/server run node:build
```

手动验证（isolate + Hyperdrive）：触发若干请求后，Postgres `pg_stat_activity` / Hyperdrive 连接数应保持平稳、不单调增长。
