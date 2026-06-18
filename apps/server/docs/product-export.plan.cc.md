# 计划：product-export —— Shopify 商品 → CSV → Bucket，按运行时选择队列

> 历史方案记录：本文保留 product-export 早期设计思路，不作为当前代码事实的权威说明。当前实现请以 `src/app/modules/product-export/README.md`、[queue.md](./queue.md) 和 [scheduler.md](./scheduler.md) 为准。当前 queue/scheduler infra 位于 `src/infra/queue`、`src/infra/scheduler`，通过 `registerQueueJob(...)`、`registerSchedulerTask(...)` 注册，并由 runtime entry 调用对应 create/dispose 生命周期。

## 背景

`product-export` 需要拉取一个店铺的**全部**商品、生成 CSV、存储以供下载。本应用是多运行时，但**启动时只进入一种运行时**：Node `process`（队列 = **pg-boss**）或 Cloudflare `isolate`（队列 = **Cloudflare Queues**）。同一份 job 代码必须在**两种后端都能跑**（你选定的模型），因此每个 job 都要塞进**更小的执行包络**——即 Cloudflare Worker 的 CPU/时长上限和 128 KB 消息上限。

两个关键事实决定了设计：

1. 代码里 seam 已经挖好：运行时能力注册表（`src/app/runtime/capabilities.ts`）按运行时选实现，和 `databaseFactory`/`bucketFactory` 完全一样。Cloudflare 的 file-task dispatcher 现在是 `runtimeNotSupported` 占位，注释明写在等 “Cloudflare Queues or another isolate-safe task transport”。
2. `Bucket` 接口（`src/infra/bucket/shared.ts`）是**流式 `put`/`open`，无 multipart、无 append**。所以大 CSV 要么用一次流式 `put` 产出，要么写成**多个 part 对象、读取时再拼接**。

**核心亮点设计（the glimmer）：** `finalize` 按 **HTTP Range** 切分 Shopify bulk 结果 JSONL。每个 `finalize-chunk{seq}` job 读一个字节区间、写一个 `parts/{seq}.csv`，最后一片 enqueue `assemble`；`assemble` 按序 `open` 各 part 并 pipe 进单个 `put`。每次调用都是**有界**工作 → **CF 安全**。小目录时区间数收敛为 1，退化成单次流式 `put`、零 assemble 开销——一条代码路径，由分片数参数化。

“全部商品”的取法：用 **Shopify Bulk Operations API**（`bulkOperationRunQuery`）——Shopify 在服务端生成 JSONL 结果文件，我们只做 JSONL→CSV 的流式转换。这样省去几百次游标翻页，且我们的计算量始终有界。

---

## 架构：四个 seam

```
QueueProducer（投递）       → 运行时能力，和 bucketFactory 同构。Node=pg-boss，CF=env.QUEUE.send
JobRegistry（name→handler） → 运行时无关，定义一次，两后端共用      ← “同一份 job”
ConsumerBootstrap          → 运行时专属：
   Node: boss.work(name, handler) 在 process 启动时拉起，shutdown 时停止
   CF:   queue(batch,env,ctx) 导出，把每条消息路由到 registry
Scheduler（定时）           → 运行时能力，保留的 seam（本次仅作兜底对账，非主驱动）：
   Node: pg-boss schedule（或 node-cron）
   CF:   Cron Triggers + scheduled(controller,env,ctx) 导出
```

**完成驱动（本次）：** 以 **`bulk_operations/finish` webhook 为主驱动**。`Scheduler` seam 完整保留并接通，但只承担**兜底对账（reconcile）**：定时扫描卡在 `running`/`finalizing` 超过阈值的 export（webhook 丢失/迟到），重新 enqueue `plan` 或重投未完成的 `finalize-chunk`。不引入轮询作为主路径。

**不变式（用约定挡住抽象泄漏）：**

- 队列 payload 只携带 **`{ exportId, ...小标量 }`**——绝不放商品、绝不放 CSV（128 KB 上限 + 可移植性）。
- **DB 记录是事实源**；队列只是触发器。每个 handler **幂等**（按 status 判断）。
- Bucket key **确定性** → 重试覆盖安全，不留孤儿对象。
- 共享 job 代码**不自行**调用 `boss.schedule()`；定时统一走 `Scheduler` 能力端口（Node=pg-boss schedule，CF=Cron Triggers），保证两运行时行为一致。

---

## 任务流

```
POST /api/product-exports
  └─ 建 product_export 行（status=queued）→ enqueue("product-export:start",{exportId}) → 202 {exportId}

product-export:start
  ├─ 读行；status≠queued → 返回（幂等）
  ├─ bulkOperationRunQuery（products 查询）
  └─ 存 bulkOpId，status=running

webhook POST /webhooks/bulk_operations/finish
  ├─ 校验（复用现有 verifyWebhook 中间件）
  ├─ 用 admin_graphql_api_id → 按 bulkOpId 匹配 product_export 行
  └─ enqueue("product-export:plan",{exportId})

product-export:plan
  ├─ 读行；status≠running → 返回
  ├─ 读完成的 bulk op → result url
  ├─ HEAD url → Content-Length；按 CHUNK_BYTES 计算区间（取值以塞进 CF CPU 为准）
  ├─ 存 totalParts=N、resultUrl，status=finalizing
  └─ enqueue N × "product-export:finalize-chunk"{exportId,seq,start,end}

product-export:finalize-chunk {seq,start,end}      ← 亮点
  ├─ 读行；该 part seq 已完成 → 返回（幂等）
  ├─ GET url 带 Range: bytes=start-end（+ 继续读到下一个 \n；seq≠0 时跳过首个不完整行）
  ├─ 流式 JSONL 行 → CSV 行（此处不写表头）→ bucket.put(parts/{exportId}/{seq}.csv)
  ├─ 原子操作：标记 part seq 完成，读 donePartsCount
  └─ 若 donePartsCount == totalParts → enqueue("product-export:assemble",{exportId})

product-export:assemble
  ├─ 读行；status=done → 返回（幂等）
  ├─ bucket.put({ key: exports/{shop}/{exportId}.csv, body: 一个流：
  │     先输出一次 CSV 表头，再按序 open() parts/0..N-1 并逐个 pipe 进去 })
  ├─ status=done，存 objectKey、rowCount
  └─ 删除 parts/*（尽力清理）

GET /api/product-exports/:id/download
  └─ 复用 BucketFileDownloadResolver + createBucketDownloadSigner
     （Node R2 → 签名 URL；CF R2 → 经 Worker 用 bucket.open 流式回传）
```

**Range / 行边界正确性（关键）：** 字节区间会把 JSONL 行从中间切断。约定：一个 chunk 读 `[start, end]`，**再继续读到下一个 `\n`** 以补全跨过 `end` 的那一行；并且**跳过到首个 `\n` 之前的字节**（除非 `seq===0`，因为那段不完整的头行属于上一个 chunk——它已读过自己的 `end`）。CSV 表头**只在 assemble 输出**，所以各 part 无表头、写入顺序无关。

**小目录退化路径：** 若 `Content-Length < CHUNK_BYTES`，`plan` 置 `totalParts=1`；单个 `finalize-chunk` 流式处理整个文件，`assemble` 仍是一次 `open→put`。（可选微优化：`totalParts===1` 时让该 chunk 直接带表头写最终对象，跳过 assemble。）

---

## 文件

### 新增：队列基础设施（`apps/server/src/infra/queue/`）

- `shared.ts` —— `QueueProducer` 接口（`enqueue<N>(name, payload, opts?)`）、`EnqueueOptions { delaySeconds?, maxAttempts?, dedupKey? }`（pg-boss × CF 的交集）、`Job<N>`、`JobHandler<N>`。
- `index.ts` —— `createQueueProducer(config, isolateOptions?)`，按 `APP_RUNTIME` 动态 import 分派，对齐 `infra/bucket/index.ts`。
- `process.ts` —— pg-boss producer + process consumer（按注册的每个 job 拉取消息，映射到 handler）。
- `isolate.ts` —— Cloudflare Queue producer + event-scoped consumer（解析、路由到 registry、逐条 `ack`/`retry`）。

### 新增：定时基础设施（`apps/server/src/infra/scheduler/`）—— 保留的 Scheduler seam

- `shared.ts` —— `Scheduler` 接口与 `ScheduledTaskRegistry`（cron 表达式 → handler）。
- `process.ts` —— 用 pg-boss `schedule()` 在 Node 启动时注册定时任务，shutdown 时停止。
- `isolate.ts` —— Cloudflare `scheduled()` event adapter，按 `controller.cron` 派发到对应 handler。
- 本次唯一注册的定时任务：**`product-export:reconcile`**——扫描卡在 `running`/`finalizing` 超过阈值的 export，重新 enqueue `plan` 或重投缺失的 `finalize-chunk`（兜底 webhook 丢失）。

### 新增：job 注册表（`apps/server/src/app/jobs/`）

- `registry.ts` —— `registerJob(name, handler, { runtimes })`、`getHandler(name)`、`listJobs()`。`runtimes` 让某 job 可标 `["node"]`，在不支持的运行时**投递时 fail-fast**（与 `requireCloudflareBinding` 风格一致）。
- `index.ts` —— import 各模块的 job 注册模块，使注册副作用在启动时执行。

### 新增：product-export 模块（镜像 `src/app/modules/file/`）

`apps/server/src/app/modules/product-export/` → `index.ts`、`controller.ts`、`service.ts`、`types.ts`、`schema.ts`、`meta.ts`、`constants.ts`、`stores/database.ts`、`jobs.ts`（注册 4 个队列 handler）、`reconcile.ts`（注册 `product-export:reconcile` 定时任务到 Scheduler）、`csv/jsonl-to-csv.ts`（JSONL→CSV 的 `TransformStream`；products 查询字段映射）、`webhook/handlers.ts`（bulk_operations/finish）。

### 新增：DB 表 `product_export`（两套 schema 树）

- `packages/database/src/models/postgres/product-exports.ts` + `sqlite/product-exports.ts`；从各自 `models/.../index.ts` 导出。
- 字段：`id, shopDomain, status(queued|running|finalizing|done|failed), bulkOpId, resultUrl, totalParts, donePartsCount, objectKey, rowCount, error, createdAt, updatedAt`。（part 完成追踪用 `donePartsCount` 原子自增；若需精确的逐 part 幂等，则加一张 `product_export_part` 兄弟表。）
- Zod schema 放 `sql-schemas/postgres|sqlite/product-exports.ts`。
- 生成迁移：`pnpm --filter @shamt/server db:pg:generate` + `db:d1:generate`。

### 新增：env provider（`packages/app-env/src/`）

- `constants/queue.ts` —— `DEFAULT_APP_QUEUE_PROVIDERS = { PGBOSS, CLOUDFLARE_QUEUE }`。
- `configs/queue.ts` —— `APP_QUEUE_PROVIDER`、`APP_QUEUE_NAME`、`APP_QUEUE_BINDING`、consumer batch/retry 配置。从 `src/index.ts` 导出。

### 改动：接通 capability + 消费端

- `src/app/runtime/capabilities.ts` —— 在 `RuntimeCapabilityInstances` 加 `queueProducerFactory: QueueProducerFactory` 与 `schedulerFactory: SchedulerFactory`。
- `src/app/runtime/process/capabilities.ts` —— 注册 pg-boss producer 与 pg-boss/node-cron scheduler。
- `src/app/runtime/isolate/cloudflare/capabilities.ts` —— 注册 CF producer（在 `bindings.ts` 新增 `isCloudflareQueue` guard 校验队列绑定）与 CF scheduler；这**替换掉投递路径上现有的 `fileModuleNotSupported` 占位**。
- `src/app/runtime/process/index.ts` —— 在 `registerProcessRuntimeCapabilities()` 之后 import `app/jobs`，`await startPgBossWorkers(registry)` 并注册定时任务。
- `src/app/runtime/process/lifecycle/shutdown.ts` —— 在 `disposeRuntimeCapabilities()` 之前 `await stopPgBossWorkers()`（含定时任务）。
- `src/app/runtime/isolate/cloudflare/index.ts` —— 给导出的 handler 加 `async queue(batch, env, ctx)` → `consumeQueueBatch(...)`，以及 `async scheduled(controller, env, ctx)` → `runScheduledTasks(...)`（保留的 cron 入口）。
- `src/app/bootstrap/register-routes.ts` —— `registerProductExportController(app)`。
- `src/app/modules/shopify/webhook/index.ts` —— 新增 `POST /bulk_operations/finish`（**主驱动**）。
- `apps/server/wrangler.json` —— 加 `queues.producers`（绑定 `QUEUE`）+ `queues.consumers`（本 worker）使 `queue()` 生效；并加 `triggers.crons`（如 `"*/5 * * * *"`）使 `scheduled()` 生效，供 reconcile 兜底。

### 复用（不要重造）

- Shopify Admin GraphQL：`createRetryableShopifyAdminClient`（`src/app/modules/shopify/admin/client.ts`）、`createShopifyClient`（`src/infra/http/shopify.ts`）。
- products 查询形状：`src/app/modules/product/meta.ts`。
- Bucket 流式 + 签名下载：`src/infra/bucket/shared.ts`、`BucketFileDownloadResolver`（`modules/file/download`）、`createBucketDownloadSigner`。
- webhook 校验中间件：`modules/shopify/webhook/index.ts`。
- capability 注册/释放助手：`setRuntimeCapability` / disposer 模式。

---

## 依赖

- 给 `apps/server` 加 `pg-boss` 依赖 + 在 `pnpm-workspace.yaml` 的 `queue` catalog 加条目（注意现有 catalog 是 `bullmq`；pg-boss 是选定的 Node 后端）。
- Cloudflare Queues 不需装包（平台绑定），但需账号开通 Queues 权益 + wrangler 配置。

---

## 验证

**构建/类型：** `pnpm --filter @shamt/server type-check`（或仓库 tsc）；`pnpm --filter @shamt/server build`。

**迁移：** 跑 `db:pg:generate` / `db:d1:generate`，检查两种方言生成的新表 SQL。

**Node / pg-boss 端到端（主开发回路）：**

1. `APP_RUNTIME=node APP_QUEUE_PROVIDER=pg-boss APP_DATABASE_PROVIDER=postgres APP_BUCKET_PROVIDER=r2|memory` 启动。
2. `POST /api/product-exports` → 202 + exportId；断言行 `status=queued→running`。
3. 模拟完成：用签名测试 payload 打 `/webhooks/bulk_operations/finish`（或把 `resultUrl` 指向本地 fixture JSONL）→ 观察 `plan → finalize-chunk×N → assemble → done`。
4. 用很小的 `CHUNK_BYTES` 强制 `totalParts>1` 以演练 **Range 路径**；断言拼接后的 CSV 行数 == 源 JSONL 行数，且表头恰好出现一次。
5. `GET /:id/download` 返回 CSV（R2 走签名 URL / memory 走流）。
6. **幂等：** 重投 finish webhook、重跑某个 chunk job → 无重复行、同一对象、`assemble` 在 `status=done` 时短路。
7. **兜底对账：** 故意不触发 webhook，让 export 停在 `running`/`finalizing`；等 reconcile 定时任务跑（或手动触发 `scheduled`）→ 观察被重新推进至 `done`。

**Cloudflare / Queues 端到端：** 带 Queues 跑 `wrangler dev`；`POST` 触发；确认 `queue()` handler 对中等规模 fixture 在 CPU 上限内跑完 `plan/finalize-chunk/assemble`。确认标 `runtimes:["node"]` 的 job（若有）在 CF 下**投递时 fail-fast**。

**单测：** `jsonl-to-csv` 转换（字段映射、转义、流式分块边界）；Range 行边界逻辑（跨行、`seq=0` 头部、尾部不完整行）；registry 运行时标记的强制。

---

## 范围外 / 后续

- 把现有 `FileTaskDispatcher` 迁移到新的 `QueueProducer`（可后做；本计划不动它以收敛范围）。
- 用 `Scheduler` 端口承载更多定时任务（如 export 产物过期清理）——seam 已建好，后续按需注册即可。
