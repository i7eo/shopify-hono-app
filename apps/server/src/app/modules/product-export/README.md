# Product Export 模块执行链路

这份文档从 `controller` 开始，把 `product-export` 当前实现里的 HTTP、Shopify Bulk Operation、webhook、queue、job、consumer、scheduler、数据库状态与 Bucket 写入顺序串起来。它描述的是当前代码行为，不是早期计划文档里的旧 job 名称。

## 模块目标

`product-export` 负责根据当前 Shopify 店铺创建商品导出任务：

1. 用户通过 HTTP 创建一个导出记录。
2. 后台 job 调用 Shopify Admin GraphQL `bulkOperationRunQuery`，让 Shopify 异步生成全量商品 JSONL。
3. Shopify Bulk Operation 完成后优先通过 webhook 通知应用。
4. 应用拿到 Bulk Operation 的 `url`、`fileSize` 等元数据后，按 Range 分片读取 JSONL。
5. 每个分片转换成一个 CSV part，写入 Bucket。
6. 所有 part 完成后 assemble 成最终 `products.csv`。
7. 对外状态统一使用 `ready` 表示可下载，不使用 `done` 作为导出完成态。

模块的核心原则：

- HTTP 请求只负责创建记录和投递第一条任务，不在请求里等待 Shopify 或 CSV 生成。
- webhook 是 Bulk Operation 完成后的主触发入口。
- scheduler/cron 只做兜底补偿，用来处理漏 webhook、重复 webhook、失败 part、重复 queue message 等情况。
- Node 和 Cloudflare 共用同一组业务 job，差异收敛在 `infra/queue`、`infra/scheduler`、`runtime.ts` 这些 runtime adapter 中。
- `product_export_parts` 使用 `(exportId, seq)` 唯一键，保证规划分片、重复 webhook、重复 queue message 都可以幂等。

## 关键文件

| 文件                                        | 作用                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `controller.ts`                             | 注册 `POST /product-exports`、`GET /product-exports`、`GET /product-exports/{id}`、`DELETE /product-exports/{id}`。   |
| `service.ts`                                | 处理 HTTP 层可复用的业务逻辑：创建记录、查询记录、软删除、启动 Shopify Bulk Operation、应用 Bulk Operation 完成结果。 |
| `queue/index.ts`                            | 创建 product-export queue message，并从 Hono request context 或 queue/scheduler context 投递 job。                    |
| `queue/constants.ts`                        | 定义 job name、daily reconcile cron、JSONL chunk 大小、Cloudflare finalize 阈值等后台常量。                           |
| `queue/jobs.ts`                             | 注册并实现所有后台 job 和 daily scheduler task。                                                                      |
| `runtime.ts`                                | 在 queue/scheduler context 下创建数据库、Bucket、Shopify Admin GraphQL client。                                       |
| `stores/database.ts`                        | `product_exports` 与 `product_export_parts` 的数据库 store，兼容 PostgreSQL 与 D1。                                   |
| `utils.ts`                                  | 状态常量、runtime 判断、Bulk Operation 状态映射、JSONL 行选择、JSONL -> CSV、CSV escaping。                           |
| `webhook/webhook.ts`                        | 处理 Shopify Bulk Operation finish webhook，并投递后续 queue job。                                                    |
| `schema.ts` / `meta.ts`                     | OpenAPI schema 与 route metadata。                                                                                    |
| `../../bootstrap/register-jobs.ts`          | 统一注册业务 queue jobs 与 scheduler tasks。                                                                          |
| `../../runtime/process/index.ts`            | Node runtime 入口，启动 HTTP server、pg-boss consumer、pg-boss scheduler。                                            |
| `../../runtime/isolate/cloudflare/index.ts` | Cloudflare runtime 入口，接收 `fetch`、`queue`、`scheduled` 事件。                                                    |

## 总体时序

```text
POST /product-exports
  -> controller.createProductExportRoute
  -> service.createProductExport()
  -> insert product_exports(status=queued)
  -> enqueue product-export.start-bulk
  -> HTTP 202

queue consumer receives product-export.start-bulk
  -> startBulkJob()
  -> load export record
  -> load offline Shopify Admin session
  -> Shopify bulkOperationRunQuery(products query)
  -> update product_exports(status=bulk_operation_running, shopifyBulkOperationId)

Shopify finishes Bulk Operation
  -> Shopify sends bulk operation finish webhook
  -> Shopify webhook middleware verifyWebhook()
  -> handleProductExportBulkOperationFinishWebhook()
  -> service.completeProductExportBulkOperation()
  -> update product_exports(status=bulk_operation_completed, resultUrl, fileSize...)
  -> enqueue product-export.bulk-finished

queue consumer receives product-export.bulk-finished
  -> bulkFinishedJob()
  -> if resultUrl missing, query Shopify BulkOperation node(id)
  -> enqueue product-export.plan-parts

queue consumer receives product-export.plan-parts
  -> planPartsJob()
  -> create product_export_parts rows by byte Range
  -> update product_exports(status=generating_csv)
  -> enqueue N x product-export.process-part

queue consumer receives product-export.process-part
  -> processPartJob()
  -> claim product_export_parts(pending/failed -> processing)
  -> fetch Shopify resultUrl with Range header
  -> select complete JSONL lines for this part
  -> convert JSONL rows to CSV rows
  -> write part CSV to Bucket
  -> mark part done
  -> if all parts done, enqueue product-export.finalize

queue consumer receives product-export.finalize
  -> finalizeJob()
  -> if Cloudflare and parts exceed threshold, status=requires_node_finalize
  -> otherwise read all part CSV objects
  -> prepend CSV header once
  -> write final products.csv to Bucket
  -> update product_exports(status=ready, bucketKey, completedAt)

daily scheduler 0 0 * * *
  -> enqueue product-export.reconcile
  -> reconcileJob()
  -> scan recoverable exports older than 15 minutes
  -> re-enqueue missing stage jobs or retry pending/failed parts
```

## Runtime 启动与注册顺序

业务模块不会自己启动 consumer，也不会自己持有 pg-boss 或 Cloudflare Queue 生命周期。当前设计是：

1. 模块声明它有哪些后台任务。
2. runtime 入口统一注册这些任务。
3. `infra/queue` 与 `infra/scheduler` 根据 runtime 启动真正的消费者或调度器。

### Node process runtime

入口是 `apps/server/src/app/runtime/process/index.ts`。

启动顺序：

1. `registerProcessRuntimeCapabilities()`
   - 注册 Node 运行时的数据库、Bucket、queue producer 等 capability。
2. `registerJobs()`
   - 调用 `registerModuleProductExportJobs()`。
   - 只注册 queue job definition 和 scheduler task definition。
   - 不消费、不执行、不连接 Shopify。
3. `bootstrapApp()`
   - 注册 HTTP routes 和中间件。
4. `serve({ fetch: app.fetch })`
   - 启动 Hono Node server。
5. `queueConsumerFactory(env).start({ logger, runtimeEnv: env })`
   - 从 `infra/queue` registry 读取所有已注册 job。
   - 为每个 job 创建 pg-boss polling consumer。
   - 使用 `APP_QUEUE_CONSUMER_MAX_BATCH_SIZE` 控制每次 fetch 的 batch size。
6. `schedulerFactory(env).start({ logger, runtimeEnv: env })`
   - 从 `infra/scheduler` registry 读取所有已注册 scheduler task。
   - 使用 pg-boss `schedule()` 注册 cron。
   - 使用 pg-boss `work()` 执行 task handler。
7. `registerProcessExceptions()` / `registerProcessExits()`
   - 处理进程异常和退出清理。

Node 下真正消费队列的顺序：

```text
pg-boss fetch(queueName, batchSize)
  -> consumeProcessJobs()
  -> consumeQueueBatch()
  -> 找到 registerQueueJob() 注册的 job
  -> job.handler(payload, context)
  -> 成功 boss.complete(queueName, jobId)
  -> 失败 boss.fail(queueName, jobId)
```

### Cloudflare isolate runtime

入口是 `apps/server/src/app/runtime/isolate/cloudflare/index.ts`。

模块加载时：

1. `registerCloudflareIsolateRuntimeCapabilities()`
   - 注册 Cloudflare 运行时 capability。
2. `registerJobs()`
   - 调用 `registerModuleProductExportJobs()`。
   - 只注册定义，不创建业务 job，不预先投递 job。
3. `const cloudflareApp = bootstrapApp()`
   - 创建 Hono app promise。

Cloudflare 事件入口：

```ts
export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  queue(batch, env) {
    return queueConsumerFactory(runtimeEnv).consume(
      batch,
      createCloudflareQueueJobContext(env),
    );
  },
  scheduled(controller, env) {
    return schedulerFactory(runtimeEnv).run(
      controller.cron,
      createCloudflareSchedulerTaskContext(env, controller.cron),
    );
  },
};
```

Cloudflare 下真正消费队列的顺序：

```text
Cloudflare Queues invokes queue(batch, env)
  -> createCloudflareQueueJobContext(env)
  -> queueConsumerFactory(context.runtimeEnv).consume(batch, context)
  -> 过滤非法 queue message，非法消息直接 ack
  -> consumeQueueBatch()
  -> 找到 registerQueueJob() 注册的 job
  -> job.handler(payload, context)
  -> 成功 message.ack()
  -> 失败 message.retry()
```

Cloudflare 下 scheduler 的顺序：

```text
Cloudflare Cron Trigger invokes scheduled(controller, env)
  -> createCloudflareSchedulerTaskContext(env, controller.cron)
  -> schedulerFactory(context.runtimeEnv).run(controller.cron, context)
  -> findSchedulerTasksByCron(cron)
  -> task.handler(context)
```

## HTTP Controller 调用顺序

`registerProductExportController(app)` 注册 4 个接口。所有接口都通过 `shopifyAdminSession()` 中间件获取当前店铺上下文，实际店铺名来自 `c.get("shopDomain")`。

### `POST /{APP_API_PREFIX}/product-exports`

用途：创建一个导出任务。

调用顺序：

1. OpenAPI route 校验 JSON body。
2. `controller` 读取：
   - `body.name`
   - `c.get("runtimeEnv")`
   - `c.get("shopDomain")`
3. 调用 `createProductExport(c, input)`。
4. `service.createProductExport()` 生成：
   - `id = crypto.randomUUID()`
   - `status = queued`
   - `shopDomain`
   - `name`
   - `createdAt` / `updatedAt`
   - Bulk Operation 字段为空。
5. `store.create(record)` 写入 `product_exports`。
6. `enqueueProductExportJob(c, product-export.start-bulk, { exportId, shopDomain })` 投递第一条后台任务。
7. 返回 HTTP `202`，响应里是刚创建的 export record。

这里的关键点是：`POST` 不直接调用 Shopify，也不生成 CSV。它只创建记录并投递 `product-export.start-bulk`。

### `GET /{APP_API_PREFIX}/product-exports`

用途：列出当前店铺的导出任务。

调用顺序：

1. 读取 query：
   - `cursor`
   - `limit`
   - `status`
2. `parseLimit()` 将非法 limit 回退到 `20`。
3. 调用 `listProductExports(c, { shopDomain, cursor, limit, status })`。
4. store 根据 `shopDomain`、可选 `status`、`deletedAt is null` 查询。
5. 返回分页结果：
   - `productExports`
   - `nextCursor`

### `GET /{APP_API_PREFIX}/product-exports/{id}`

用途：查询单个导出任务状态。

调用顺序：

1. 读取 path param `id`。
2. 调用 `getProductExport(c, { id, shopDomain })`。
3. store 按 `id + shopDomain + deletedAt is null` 查询。
4. 找不到时抛出 404。
5. 找到时返回 record。

### `DELETE /{APP_API_PREFIX}/product-exports/{id}`

用途：软删除导出任务。

调用顺序：

1. 读取 path param `id`。
2. 先调用 `getProductExport()` 确认记录存在且属于当前店铺。
3. 调用 `store.delete()` 设置 `deletedAt`。
4. 返回 HTTP `204`。

当前删除是软删除。它不负责撤销已经提交给 Shopify 的 Bulk Operation，也不主动删除 Bucket 中已经生成的对象。

## Queue message 与投递方式

product-export 使用统一的 queue envelope：

```ts
{
  name: "product-export.start-bulk",
  payload: {
    exportId: "uuid",
    shopDomain: "demo.myshopify.com",
    seq: 0
  },
  requestId: "optional request id",
  version: 1
}
```

`seq` 只在 part 相关 job 中使用。

### 从 HTTP/webhook context 投递

使用 `enqueueProductExportJob(c, name, payload)`：

1. 从 runtime capability 里取 `queueProducerFactory`。
2. `queueProducerFactory(c)` 创建当前 runtime 的 producer。
3. 包装 queue message。
4. 设置：
   - `idempotencyKey = jobName:exportId:seq`
   - `maxAttempts = c.get("runtimeEnv").APP_QUEUE_CONSUMER_MAX_RETRIES`
5. 调用 producer enqueue。

这种方式用于：

- `service.createProductExport()` 投递 `product-export.start-bulk`。
- `webhook/webhook.ts` 投递 `product-export.bulk-finished`。

### 从 queue/scheduler context 投递

使用：

- `enqueueProductExportJobFromContext(context, name, payload)`
- `enqueueProductExportJobsFromContext(context, name, payloads)`

调用顺序：

1. 动态导入 `@/infra/queue` 的 `createQueueProducer()`。
2. 如果是 Cloudflare runtime，从 `context.bindings[APP_QUEUE_BINDING]` 取 Queue binding。
3. 如果是 Node runtime，由 process queue adapter 取 pg-boss producer。
4. 投递单条或批量消息。

这种方式用于 job 内部继续推进下一阶段，例如：

- `bulkFinishedJob()` 投递 `plan-parts`。
- `planPartsJob()` 批量投递 `process-part`。
- `processPartJob()` 在全部 part done 后投递 `finalize`。
- `reconcileJob()` 重新投递需要补偿的任务。

## 已注册的 product-export jobs

所有 job 在 `registerModuleProductExportJobs()` 中注册。该函数内部有 `registered` guard，重复调用不会重复注册。

| job name                       | handler           | 主要作用                                                           |
| ------------------------------ | ----------------- | ------------------------------------------------------------------ |
| `product-export.start-bulk`    | `startBulkJob`    | 为刚创建的 export 启动 Shopify Bulk Operation。                    |
| `product-export.bulk-finished` | `bulkFinishedJob` | Bulk Operation 完成后，确保结果元数据已落库，并进入 part 规划。    |
| `product-export.plan-parts`    | `planPartsJob`    | 根据 `fileSize` 规划 JSONL byte Range parts，并批量投递 part job。 |
| `product-export.process-part`  | `processPartJob`  | 处理一个 Range chunk：JSONL -> CSV part -> Bucket。                |
| `product-export.finalize`      | `finalizeJob`     | 合并全部 CSV part，生成最终 `products.csv`。                       |
| `product-export.reconcile`     | `reconcileJob`    | 每日补偿，扫描卡住或可重试的 export。                              |

## Job 详细执行顺序

### 1. `product-export.start-bulk`

handler：`startBulkJob(payload, context)`

触发来源：

- `POST /product-exports` 创建记录后投递。
- `reconcileJob()` 发现 record 仍处于 `queued` 时补投。

执行顺序：

1. `parseProductExportJobPayload(payload)` 校验 `exportId` 和 `shopDomain`。
2. `createStore(context)` 创建 `ProductExportStore`。
3. `store.findById({ id: exportId, shopDomain })` 查 export。
4. 如果记录不存在，直接返回。
5. 如果记录状态不是 `queued`，直接返回。
6. `createProductExportDatabase(context)` 创建数据库 adapter。
7. `createProductExportShopifyClient(runtimeEnv, database, shopDomain)`：
   - 从数据库 session storage 里找当前店铺 offline session。
   - 如果没有 offline session，则退而找有 accessToken 的 session。
   - 校验 session 是否 active。
   - 创建 Shopify Admin GraphQL client。
8. `startProductExportBulkOperationForRecord({ client, record, store })`：
   - 如果 record 已有 `shopifyBulkOperationId`，直接返回，避免重复启动。
   - 调用 Shopify Admin GraphQL `bulkOperationRunQuery`。
   - Bulk query 当前导出字段：
     - `id`
     - `title`
     - `handle`
     - `status`
     - `vendor`
     - `productType`
     - `createdAt`
     - `updatedAt`
   - 成功后更新：
     - `shopifyBulkOperationId`
     - `shopifyBulkOperationStatus`
     - `status = bulk_operation_running`
     - `updatedAt`
   - 如果 Shopify 返回 GraphQL error 或 userErrors，更新 `status = failed` 和 `errorMessage`，然后抛出错误让 queue provider 重试或进入失败逻辑。

幂等点：

- 只有 `queued` 状态会启动。
- 已经有 `shopifyBulkOperationId` 的记录不会重复启动 Shopify Bulk Operation。

### 2. Bulk Operation finish webhook

handler：`handleProductExportBulkOperationFinishWebhook(c)`

触发来源：

- Shopify webhook route 中的 Bulk Operation finish topic。

执行顺序：

1. Shopify webhook route 先执行 `verifyWebhook()`。
2. `verifyWebhook()` 校验签名、topic、shop、payload size 等。
3. webhook handler 读取 `c.var.webhookPayload`。
4. `parseBulkOperationFinishWebhookPayload()` 要求至少有：
   - `admin_graphql_api_id`
   - `status`
5. 如果 payload 无效，记录 warn，但返回 `{ ok: true }`，避免 Shopify 不断重试无效 webhook。
6. 调用 `completeProductExportBulkOperation(c, input)`：
   - 用 `admin_graphql_api_id` 查 `product_exports.shopifyBulkOperationId`。
   - 如果找不到，说明不是当前模块管理的 Bulk Operation，返回 null。
   - 如果找到但 `shopDomain` 不一致，返回 null。
   - 写入 Shopify 完成信息：
     - `completedAt`
     - `errorCode`
     - `fileSize`
     - `objectCount`
     - `partialDataUrl`
     - `resultUrl`
     - `shopifyBulkOperationStatus`
     - `status = mapBulkOperationStatus(status)`
7. 如果找到本模块记录，投递 `product-export.bulk-finished`。
8. 返回 `{ ok: true }`。

关于 `verifyWebhook()` 和大数据：

- webhook payload 是 Shopify 的完成通知，只包含 Bulk Operation ID、状态、结果 URL、文件大小等小字段。
- 真正大的 JSONL 数据不会放在 webhook payload 里。
- JSONL 大数据是在后续 `processPartJob()` 中通过 `resultUrl` 和 HTTP `Range` header 主动下载。
- 因此 `DEFAULT_WEBHOOK_MAX_SIZE` 会限制 webhook 请求体大小，但不会直接限制 JSONL part 的传输。
- 当前代码把 `PRODUCT_EXPORT_JSONL_CHUNK_BYTES` 设置为 `DEFAULT_WEBHOOK_MAX_SIZE`，这是复用这个大小作为 part chunk 的工程阈值；它不是因为 JSONL 经过了 webhook。

### 3. `product-export.bulk-finished`

handler：`bulkFinishedJob(payload, context)`

触发来源：

- webhook handler 在 record 匹配成功后投递。
- `reconcileJob()` 发现 record 仍处于 `bulk_operation_running` 时补投。

执行顺序：

1. 校验 payload。
2. 根据 `exportId + shopDomain` 查 export。
3. 如果记录不存在或没有 `shopifyBulkOperationId`，直接返回。
4. 如果 record 没有 `resultUrl`：
   - 创建数据库 adapter。
   - 创建 Shopify Admin GraphQL client。
   - 调用 `fetchProductExportBulkOperation(client, shopifyBulkOperationId)`。
   - 查询 Shopify BulkOperation node：
     - `status`
     - `url`
     - `partialDataUrl`
     - `objectCount`
     - `fileSize`
     - `errorCode`
     - `completedAt`
   - 调用 `updateBulkOperationResult()`。
   - `updateBulkOperationResult()` 内部复用 `completeProductExportBulkOperation()`，保证 webhook 和补偿查询使用同一套状态映射。
5. 投递 `product-export.plan-parts`。

幂等点：

- webhook 已经写入 `resultUrl` 时，job 不重复查询 Shopify。
- webhook 未带齐字段或漏 webhook 时，job/cron 可以重新查询 Shopify。

### 4. `product-export.plan-parts`

handler：`planPartsJob(payload, context)`

触发来源：

- `bulkFinishedJob()` 投递。
- `reconcileJob()` 发现 record 已处于 `bulk_operation_completed` 时补投。
- 重复 webhook 或重复 queue message 也可能再次投递。

执行顺序：

1. 校验 payload。
2. 查 export record。
3. 如果没有 `resultUrl` 或没有 `fileSize`，直接返回。
4. `store.getPartStats(record.id)` 查看是否已经有 parts。
5. 如果 parts 已存在：
   - 不重新创建 parts。
   - 调用 `enqueuePendingParts()`。
   - 只把状态是 `pending` 或 `failed` 的 part 重新投递为 `product-export.process-part`。
6. 如果 parts 不存在：
   - 调用 `createPartRecords(record, now)`。
   - 从 `0` 到 `fileSize - 1` 按 `PRODUCT_EXPORT_JSONL_CHUNK_BYTES` 创建 part。
   - 每个 part 有：
     - `seq`
     - `rangeStart`
     - `rangeEnd`
     - `status = pending`
     - `attempts = 0`
   - `seq = 0` 的 `rangeStart` 从 `0` 开始。
   - `seq > 0` 的 `rangeStart` 会向前减去 `PRODUCT_EXPORT_JSONL_CHUNK_OVERLAP_BYTES`，给跨 chunk 的 JSONL 行留 overlap。
   - `rangeEnd` 是当前 nominal chunk 的结尾。
7. `store.createParts(parts)` 批量写入 `product_export_parts`。
   - PostgreSQL 和 D1 都使用 `(exportId, seq)` on conflict do nothing。
8. 更新 export：
   - `status = generating_csv`
   - `updatedAt = now`
9. 批量投递 `N x product-export.process-part`，payload 为：
   - `exportId`
   - `shopDomain`
   - `seq`

幂等点：

- `product_export_parts` 的 `(exportId, seq)` 唯一键防止重复创建 part。
- parts 已存在时只重投未完成 part。

### 5. `product-export.process-part`

handler：`processPartJob(payload, context)`

触发来源：

- `planPartsJob()` 批量投递。
- `reconcileJob()` 对 `pending` / `failed` parts 补投。
- `planPartsJob()` 重试时发现 parts 已存在，也会补投未完成 parts。

执行顺序：

1. 校验 payload。
2. 如果没有 `seq`，直接返回。
3. 查 export record。
4. `store.claimPart({ exportId, seq })` 抢占 part：
   - 只有 `pending` 或 `failed` 可以被更新为 `processing`。
   - `attempts = attempts + 1`。
   - `lockedAt = now`。
   - 返回被 claim 的 part。
5. 如果 export 不存在、没有 `resultUrl`、或 part 没有 claim 到，直接返回。
6. 创建 Bucket adapter。
7. `processPart(record, part, bucket)`：
   - 对 Shopify `record.resultUrl` 发起 `fetch()`。
   - 带 Range header：
     - `Range: bytes={part.rangeStart}-{part.rangeEnd}`
   - 接受 `200` 或 `206` 响应。
   - `response.text()` 读取该 JSONL chunk。
   - `selectCompleteLines(jsonl, part)` 选择完整且属于当前 part nominal byte window 的 JSONL lines。
   - `jsonlToCsv(lines)` 将每行 Shopify product JSON 转成 CSV row。
   - 每个 part CSV 不写 header，只写数据行。
   - 写入 Bucket：
     - key: `{shopDomain}/product-exports/{exportId}/parts/{seq}.csv`
     - contentType: `text/csv`
     - expiresAt: 7 天后
     - maxBytes: `PRODUCT_EXPORT_MAX_PART_BYTES`
8. 成功后 `store.markPartDone()`：
   - `status = done`
   - `bucketKey`
   - `bucketProvider`
   - `byteSize`
   - `rowCount`
   - `completedAt`
9. 失败时 `store.markPartFailed()`：
   - `status = failed`
   - `errorCode = PROCESS_PART_FAILED`
   - `errorMessage`
   - 然后重新抛出错误，让 queue provider 处理 retry。
10. 再次读取 `store.getPartStats(record.id)`。
11. 如果 `stats.total > 0 && stats.done === stats.total`，投递 `product-export.finalize`。

幂等点：

- `claimPart()` 是最重要的并发闸门。
- 重复 queue message 到达时，如果第一个 message 已经把 part 从 `pending` 改为 `processing` 或 `done`，后续 message claim 不到 part，会直接 no-op。
- part 写入 Bucket 后才标记 done；失败会标记 failed，后续 reconcile 可重试。

### 6. `product-export.finalize`

handler：`finalizeJob(payload, context)`

触发来源：

- 最后一个 `processPartJob()` 发现所有 part 都 done 后投递。
- `reconcileJob()` 发现所有 part 都 done 但 export 尚未 ready 时补投。

执行顺序：

1. 校验 payload。
2. 查 export record。
3. 如果记录不存在，直接返回。
4. 如果 record 已经是 `ready`，直接返回。
5. 读取 part stats。
6. 如果没有 parts，或不是所有 parts 都 done，直接返回。
7. 读取所有 parts，按 `seq` 顺序返回。
8. 如果当前是 Cloudflare runtime 且 `parts.length > PRODUCT_EXPORT_CLOUDFLARE_FINALIZE_PART_THRESHOLD`：
   - 不在 Cloudflare 上 assemble。
   - 更新 export：
     - `status = requires_node_finalize`
     - `updatedAt = now`
   - 返回。
9. 否则创建 Bucket adapter。
10. `finalizeParts(record, parts, bucket)`：
    - 初始化 chunks，第一段是 `CSV_HEADER`。
    - 逐个读取 part 的 Bucket object。
    - 把所有 part CSV 追加到 chunks。
    - 写最终文件：
      - key: `{shopDomain}/product-exports/{exportId}/products.csv`
      - originalName/safeName: `products.csv`
      - contentType: `text/csv`
      - expiresAt: 7 天后
11. 更新 export：
    - `bucketKey`
    - `bucketProvider`
    - `completedAt = now`
    - `fileSize = finalObject.byteSize`
    - `status = ready`
    - `updatedAt = now`

关于 Cloudflare Free：

- Cloudflare 可以处理 part，也可以 assemble 小导出。
- 当 part 数超过 `PRODUCT_EXPORT_CLOUDFLARE_FINALIZE_PART_THRESHOLD`，Cloudflare 不继续执行大 assemble，而是标记 `requires_node_finalize`。
- 这个状态表示需要 Node runtime 接手 finalize，避免在 Cloudflare isolate 中做长时间、大内存的合并任务。

### 7. `product-export.reconcile`

handler：`reconcileJob(_payload, context)`

触发来源：

- daily scheduler task，cron 为 `0 0 * * *`。
- scheduler task 本身不直接扫描数据库，而是先投递 `product-export.reconcile` 到 queue。

为什么 scheduler 先投 queue：

- 保持重活都走 queue consumer。
- Node 下通过 pg-boss queue 执行业务补偿。
- Cloudflare 下通过 Cloudflare Queues 执行业务补偿。
- scheduler 只负责“到点触发”，不承担长任务。

执行顺序：

1. `store.listRecoverableExports({ olderThan })`。
2. `olderThan = now - 15 minutes`。
3. 查询排除：
   - `ready`
   - `canceled`
   - `deletedAt is not null`
4. 对每个可恢复 record：
   - 如果 `status = queued`：
     - 投递 `product-export.start-bulk`。
   - 如果 `status = bulk_operation_running`：
     - 投递 `product-export.bulk-finished`。
     - 这个 job 会在 `resultUrl` 缺失时查询 Shopify。
   - 如果 `status = bulk_operation_completed`：
     - 投递 `product-export.plan-parts`。
   - 其他非终态：
     - 查询 `pending` / `failed` parts。
     - 批量投递 `product-export.process-part`。
     - 如果 stats 显示所有 parts 都 done，投递 `product-export.finalize`。

reconcile 不会对 `ready` 记录继续处理，因此导出完成后天然退出每日补偿范围，不需要额外“清除 daily scheduler”。当前 scheduler 是模块级 daily task，不是每个 export 一个独立 cron。

## Scheduler 注册顺序

`registerModuleProductExportJobs()` 里注册：

```ts
registerSchedulerTask({
  name: PRODUCT_EXPORT_QUEUE_JOBS.RECONCILE,
  cron: PRODUCT_EXPORT_RECONCILE_CRON,
  handler: async (context) => {
    // create queue producer
    // enqueue product-export.reconcile
  },
});
```

其中：

- `PRODUCT_EXPORT_RECONCILE_CRON = "0 0 * * *"`。
- Node 下 `schedulerFactory(env).start()` 使用 pg-boss schedule/work 执行这个 task。
- Cloudflare 下 `scheduled()` 事件由 Cron Trigger 触发，再通过 `schedulerFactory(runtimeEnv).run(controller.cron, context)` 找到同 cron 的 task。

## 数据表与状态机

### `product_exports`

主要字段：

| 字段                         | 含义                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `id`                         | export 主键，当前使用 `crypto.randomUUID()`。           |
| `shopDomain`                 | Shopify 店铺域名，用来做租户隔离。                      |
| `name`                       | 用户创建导出时传入的名称。                              |
| `status`                     | export 主状态。                                         |
| `shopifyBulkOperationId`     | Shopify Bulk Operation GraphQL ID。                     |
| `shopifyBulkOperationStatus` | Shopify 原始 Bulk Operation 状态。                      |
| `resultUrl`                  | Shopify 生成的 JSONL 下载 URL。                         |
| `partialDataUrl`             | Shopify partial data URL。                              |
| `objectCount`                | Shopify 返回的对象数量。                                |
| `fileSize`                   | Bulk JSONL 文件大小；finalize 后会更新为最终 CSV size。 |
| `bucketProvider`             | 最终 CSV 所在 Bucket provider。                         |
| `bucketKey`                  | 最终 CSV object key。                                   |
| `errorCode` / `errorMessage` | 错误信息。                                              |
| `completedAt`                | 最终 ready 时间，或 Shopify 完成时间字段来源之一。      |
| `deletedAt`                  | 软删除时间。                                            |

状态值来自 `@shamt/database`：

| 状态                       | 进入时机                                                     |
| -------------------------- | ------------------------------------------------------------ |
| `queued`                   | HTTP 创建 export 后。                                        |
| `bulk_operation_running`   | `start-bulk` 成功提交 Shopify Bulk Operation 后。            |
| `bulk_operation_completed` | webhook 或补偿查询确认 Shopify Bulk Operation completed 后。 |
| `generating_csv`           | `plan-parts` 创建 parts 并开始处理 CSV 后。                  |
| `ready`                    | `finalize` 写入最终 CSV 后。                                 |
| `requires_node_finalize`   | Cloudflare runtime 下 part 数超过 assemble 阈值。            |
| `failed`                   | Bulk Operation 启动失败、Shopify 状态失败或过期等。          |
| `canceled`                 | 保留状态，当前 delete 是软删除，不直接写该状态。             |

### `product_export_parts`

主要字段：

| 字段                           | 含义                                      |
| ------------------------------ | ----------------------------------------- |
| `id`                           | part 主键。                               |
| `exportId`                     | 关联 `product_exports.id`。               |
| `seq`                          | part 序号，从 0 开始。                    |
| `status`                       | part 状态。                               |
| `rangeStart` / `rangeEnd`      | 从 Shopify result URL 读取的 byte range。 |
| `bucketProvider` / `bucketKey` | part CSV 写入后的 object 信息。           |
| `byteSize`                     | part CSV 字节数。                         |
| `rowCount`                     | part CSV 数据行数。                       |
| `attempts`                     | claim 次数。                              |
| `lockedAt`                     | part 被 worker claim 的时间。             |
| `completedAt`                  | part 完成时间。                           |
| `errorCode` / `errorMessage`   | part 处理失败信息。                       |

part 状态：

| 状态         | 含义                                        |
| ------------ | ------------------------------------------- |
| `pending`    | 已规划，等待处理。                          |
| `processing` | 已被某个 consumer claim。                   |
| `done`       | CSV part 已写入 Bucket。                    |
| `failed`     | 处理失败，允许 reconcile 或重试重新 claim。 |

唯一键：

```text
(exportId, seq)
```

这个唯一键是 part 规划幂等的基础。

## Range JSONL -> CSV part 的细节

Shopify Bulk Operation result URL 返回的是 JSONL。每一行是一个 JSON 对象。当前导出的是 product 节点，CSV header 是：

```csv
id,title,handle,status,vendor,productType,createdAt,updatedAt
```

为什么需要 overlap：

- HTTP Range 按 byte 切。
- JSONL 按换行分隔。
- 一个 product JSON line 可能跨越两个 byte chunk。
- 如果简单按 Range 转 CSV，chunk 边界上的半行会 JSON parse 失败，或重复处理。

当前策略：

1. `plan-parts` 为 `seq > 0` 的 part 向前多取一小段 overlap。
2. `process-part` 读取 `rangeStart-rangeEnd`。
3. `selectCompleteLines(jsonl, part)` 只选择：
   - 当前 chunk 中完整的 line。
   - line 的起始 byte 落在该 part 的 nominal window 中。
4. overlap 里属于前一个 part 的 line 会被跳过，避免重复 CSV row。
5. part CSV 不包含 header。
6. final CSV 在 `finalize` 时只写一次 header。

## 幂等、重试与补偿

### 重复 `POST`

当前 `POST` 每次都会创建一个新的 export ID，因此不把重复 HTTP 请求合并为同一条 export。后续如果需要用户级幂等，可以在 API 层加入 idempotency key。

### 重复 `start-bulk`

防护点：

- `startBulkJob()` 只处理 `status = queued` 的记录。
- `startProductExportBulkOperationForRecord()` 遇到已有 `shopifyBulkOperationId` 会直接返回。

### 重复 webhook

防护点：

- `completeProductExportBulkOperation()` 按 `shopifyBulkOperationId` 找 record 并 update 同一行。
- `bulk-finished` 重复投递也只是再次进入 `plan-parts`。
- `plan-parts` 发现 parts 已存在后不会重复创建，只会重投未完成 parts。

### 重复 `plan-parts`

防护点：

- 先查 part stats。
- `createParts()` 使用 `(exportId, seq)` on conflict do nothing。
- 已存在 parts 时只投递 pending/failed parts。

### 重复 `process-part`

防护点：

- `claimPart()` 只允许 `pending` / `failed` -> `processing`。
- 已经被 claim、已完成、或不存在的 part 会让重复消息 no-op。

### `process-part` 失败

处理方式：

- catch error。
- `markPartFailed()` 写入 `status = failed` 和错误信息。
- 抛出错误交给 queue provider retry。
- daily reconcile 后续还会重新投递 failed part。

### 重复 `finalize`

防护点：

- 如果 export 已经 `ready`，直接返回。
- 如果 parts 没有全部 done，直接返回。
- 只有全部 part done 才会 assemble。

### 漏 webhook

补偿方式：

- daily `product-export.reconcile` 扫描 `bulk_operation_running` 且超过 15 分钟的 record。
- 投递 `product-export.bulk-finished`。
- `bulkFinishedJob()` 在缺少 `resultUrl` 时主动查询 Shopify BulkOperation node。

## Node 与 Cloudflare 的差异

业务 job 尽量不关心 runtime。差异主要在 infra 和 runtime adapter。

| 能力           | Node process                                        | Cloudflare isolate                              |
| -------------- | --------------------------------------------------- | ----------------------------------------------- |
| Queue producer | `pg-boss`                                           | Cloudflare Queues binding                       |
| Queue consumer | `queueConsumerFactory(env).start()` polling pg-boss | `queue(batch, env)` platform event              |
| Scheduler      | pg-boss `schedule()` + `work()`                     | Cron Trigger `scheduled()` event                |
| Database       | `createDatabase(config)`                            | D1 binding 或 Hyperdrive binding                |
| Bucket         | process bucket adapter                              | R2 binding 或配置的 bucket adapter              |
| Shopify client | 从数据库加载 offline session                        | 从 binding-backed database 加载 offline session |
| 大 assemble    | 可以继续执行                                        | 超过 part 阈值标记 `requires_node_finalize`     |

当前能力矩阵的含义：

- Node + pg-boss：支持。
- Node + Cloudflare Queues：不支持。
- Cloudflare + pg-boss：不支持。
- Cloudflare + Cloudflare Queues：支持。

## Cloudflare Queue consumer 与 batch

`infra/queue` 的 shared consumer 支持 batch，但 product-export 当前注册的是普通 handler，不是 batch handler。

实际行为：

1. runtime consumer 仍然可以一次拿到多个 message。
2. `consumeQueueBatch()` 会按 `message.body.name` 分组。
3. 如果 job definition 是 batch mode，就一次调用 `batchHandler(messages, context)`。
4. 如果 job definition 是普通 mode，就逐条调用 `handler(payload, context)`。

product-export 选择普通 handler 的原因：

- 每个 part 有独立的 DB claim、Range fetch、Bucket write。
- 单条失败不应该影响同 batch 的其他 part。
- 幂等边界更清晰，补偿也更直接。

## 常见排查路径

### 创建后一直是 `queued`

可能原因：

- queue producer 未配置或当前 runtime/provider 矩阵不支持。
- Node 下 pg-boss consumer 没有启动。
- Cloudflare 下 wrangler `queues.producers` / `queues.consumers` binding 未生成或名称不一致。
- `product-export.start-bulk` job 未注册，检查 `registerJobs()` 是否在 runtime 入口执行。

排查顺序：

1. 看 `product_exports.status` 是否为 `queued`。
2. 看 queue provider 中是否有 `product-export.start-bulk` 消息。
3. 看 runtime 入口是否执行了 `registerJobs()`。
4. 看 `queueConsumerFactory(env).start()` 或 Cloudflare `queue()` 是否被触发。

### 一直是 `bulk_operation_running`

可能原因：

- Shopify Bulk Operation 尚未完成。
- webhook 未送达或验签失败。
- webhook 到达但不是当前模块管理的 Bulk Operation。
- `bulk-finished` job 没有消费。

补偿机制：

- 每天 0 点 `reconcile` 会重投 `bulk-finished`。
- `bulkFinishedJob()` 会主动查询 Shopify BulkOperation。

### 一直是 `bulk_operation_completed`

可能原因：

- `plan-parts` 没有消费。
- Bulk Operation record 缺少 `resultUrl` 或 `fileSize`。
- queue consumer 未启动。

排查顺序：

1. 看 record 是否有 `resultUrl`。
2. 看 record 是否有 `fileSize`。
3. 看是否存在 `product_export_parts`。
4. 看是否有 `product-export.plan-parts` 消息。

### 一直是 `generating_csv`

可能原因：

- 某些 parts 还在 `pending` / `processing` / `failed`。
- Shopify result URL Range fetch 失败。
- Bucket 写入失败。
- Cloudflare Queue retry 尚未完成。

排查顺序：

1. 查 `product_export_parts` 按 status 统计。
2. 看 failed part 的 `errorMessage`。
3. 看 part 是否有 `bucketKey`。
4. 如果所有 parts 都 done，看是否有 `product-export.finalize` 消息。

### 状态变成 `requires_node_finalize`

含义：

- Cloudflare runtime 已经处理完 parts。
- part 数超过 Cloudflare finalize 阈值。
- 当前 isolate 不继续 assemble，避免 Cloudflare Free/Workers 执行时间或内存瓶颈。

处理方向：

- 用 Node runtime 消费/补偿 finalize。
- 或后续实现专门的 Node finalize worker，扫描 `requires_node_finalize` 并投递 `product-export.finalize`。

### webhook payload size 和 part 大小混淆

需要区分：

- webhook payload：Shopify 发给应用的小 JSON 通知，经过 `verifyWebhook()`。
- JSONL result：应用后续从 Shopify result URL 主动 Range 下载的大文件，不经过 `verifyWebhook()`。
- part chunk size：当前用 `DEFAULT_WEBHOOK_MAX_SIZE` 作为工程阈值计算 chunk 大小，但这只是复用配置值，不代表 JSONL 通过 webhook。

## 当前没有做的事情

当前模块还没有实现或不在本 README 范围内的能力：

- 没有下载最终 CSV 的 HTTP endpoint。
- `DELETE` 不撤销 Shopify Bulk Operation。
- `DELETE` 不删除 Bucket objects。
- 没有用户传入 idempotency key 来合并重复创建请求。
- `requires_node_finalize` 只标记状态，具体 Node 接手策略需要由部署或后续 worker 约定。
- part CSV 与 final CSV 设置了 7 天过期时间，具体 Bucket provider 是否执行过期清理取决于 bucket adapter 和存储后端。

## 一句话总结

`product-export` 的主链路是：controller 创建 `queued` 记录并投递 `start-bulk`，Shopify webhook 推进到 `bulk-finished`，queue jobs 规划 Range parts 并把 JSONL 分片转成 CSV part，最后 `finalize` 合并成 `ready`；scheduler 每天 0 点只负责补偿漏掉或失败的阶段，真正的后台执行统一走 `infra/queue` consumer。
