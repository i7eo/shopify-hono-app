# Product Export 异步导出计划

## Summary

实现 `product-exports` 资源：HTTP 只创建/查询导出任务，Shopify Bulk Operation 负责拉取商品数据，Node 运行时用 `pg-boss` 推进任务，Cloudflare 运行时用 Queues 推进任务，Shopify bulk ops webhook 作为主完成通知，cron 只做漏通知/卡状态兜底，最终 CSV 写入现有 Bucket 抽象。

## Key Changes

- 新增 REST API：
  - `POST /api/product-exports` 创建导出任务，返回 `202`
  - `GET /api/product-exports` 列表，支持 `cursor/limit/status`
  - `GET /api/product-exports/{id}` 查询状态
  - `GET /api/product-exports/{id}/file` 下载 CSV，未 ready 返回 `409`
  - `DELETE /api/product-exports/{id}` 取消/删除记录
- 新增 `product_exports` 表：
  - `id, shopDomain, name, status, selectionMode, selectionPayload, fields, format`
  - `shopifyBulkOperationId, shopifyBulkOperationUrl, bucketProvider, bucketKey, byteSize`
  - `errorCode, errorMessage, createdAt, updatedAt, completedAt, deletedAt`
- 状态机：
  - `queued -> starting_bulk_operation -> bulk_operation_running -> generating_csv -> ready`
  - 失败进入 `failed`，删除/取消进入 `canceled`
- 选择模型：
  - `selectionMode: "all" | "ids" | "query"`
  - `selectionPayload` 存商品 IDs 或 Shopify product query/filter
  - v1 默认支持 `all` 和 `ids`，`query` 作为兼容字段保留

## Runtime And Queue Design

- 新增统一任务抽象 `ProductExportTaskDispatcher`：
  - `{ type: "start-bulk-operation"; exportId; shopDomain }`
  - `{ type: "generate-csv"; exportId; shopDomain }`
  - `{ type: "reconcile-export"; exportId; shopDomain }`
- Node runtime：
  - 使用 `pg-boss`，启动时注册 worker
  - `POST /product-exports` 写 DB 后 enqueue `start-bulk-operation`
  - Node 下 product export queue 要求 PostgreSQL；如果 Node + D1，则 product-export background queue 返回 runtime unsupported
- Cloudflare runtime：
  - 使用 Cloudflare Queues binding
  - Worker export 增加 `queue()` consumer 和 `scheduled()` cron handler
  - `wrangler.json` 增加 queue producer/consumer 和 cron trigger
- Cron 兜底：
  - 只扫描 `bulk_operation_running` 且 `updatedAt` 超过阈值的任务
  - 查询 Shopify current/bulk operation 状态
  - 发现完成后 enqueue `generate-csv`
  - 不作为主链路，不高频轮询

## Shopify And Bucket Flow

- 创建任务后，queue worker 使用店铺 offline session 调 Admin GraphQL `bulkOperationRunQuery`
- Bulk query 根据 `selectionMode/fields` 生成，只查询 CSV 所需字段
- Shopify webhook 增加 bulk operation 完成路由，例如 `/webhooks/bulk_operations/finish`
- Webhook 验签后根据 `admin_graphql_api_id` 或 payload 中 bulk operation id 找到 `product_exports` 记录，然后 enqueue `generate-csv`
- `generate-csv` worker：
  - 获取 bulk operation result URL
  - stream 读取 JSONL
  - stream/分块转换 CSV
  - 写入 Bucket，key 使用 `{shopDomain}/product-exports/{exportId}/products.csv`
  - 更新任务为 `ready`
- Bucket 继续使用现有 runtime abstraction：
  - Node + memory 用于本地开发
  - Node + R2 使用 S3-compatible
  - Cloudflare + R2 使用 R2 binding

## Test Plan

- API tests：
  - 创建导出返回 `202`，DB 记录为 `queued`
  - ready 前下载返回 `409`
  - ready 后下载返回 CSV stream 或 redirect
  - 列表按 shopDomain 隔离
- Queue tests：
  - Node dispatcher 调用 `pg-boss.send`
  - Cloudflare dispatcher 调用 Queue binding `send`
  - 重复投递不会重复启动 bulk op 或覆盖 ready 文件
- Webhook tests：
  - bulk operation finish webhook 验签成功后 enqueue `generate-csv`
  - 无匹配 export 时返回成功并记录日志，避免 Shopify 重试风暴
- Cron tests：
  - 只 reconcile 卡在 `bulk_operation_running` 的旧任务
  - 已 ready/failed/canceled 任务不会被处理
- CSV tests：
  - JSONL 转 CSV 字段顺序稳定
  - 特殊字符、逗号、换行、双引号正确转义
  - 大数据输入不一次性读入内存

## Assumptions

- `product-export` 第一版只负责导出商品 CSV，不负责导入或修改 Shopify 商品。
- Node 后台队列固定用 `pg-boss`，因此 Node 生产环境需要 PostgreSQL。
- Cloudflare 后台队列固定用 Cloudflare Queues。
- 主完成信号来自 Shopify bulk operation webhook；cron 只负责补偿漏通知或异常卡住的任务。
- CSV 文件是最终产物，Bucket 不作为任务状态存储；任务状态始终以 DB 为准。
