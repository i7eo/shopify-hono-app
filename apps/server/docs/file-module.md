# File Module Design

本文记录 `apps/server` file module 的已确认设计决策。它是实现前的设计记录，用于后续按同一方案落地代码。

## 目标

file module 负责在 Shopify embedded app 中上传、保存、下载和过期清理文件。模块必须同时支持 Node process 和 Cloudflare Workers runtime，并且遵循当前项目的 runtime capability 边界：业务模块不直接判断平台，也不静态导入平台专属实现。

## 已确认决策

- 删除独立的“获取下载链接”接口。
- 用户调用 `GET /api/files/{id}/download` 时直接下载文件。
- Node runtime 从本地文件系统 stream 文件内容。
- Cloudflare runtime 返回 R2 custom domain 的短期签名跳转链接。
- runtime 差异必须遵循 `src/app/runtime/capabilities.ts` 的注入逻辑。
- Node 上传文件存储在 `apps/server/public/files` 下。
- Node 本地文件默认 24 小时后过期并自动删除。
- Cloudflare 上传文件存储在 R2。
- 数据库访问统一使用 Drizzle ORM。
- Node 默认走自建 PostgreSQL，但也必须支持 Neon。
- Cloudflare 走 Neon。
- 第一阶段采用 Node-first vertical slice，只完成 Node 下最小可执行 demo。
- 第一阶段不接数据库；文件元数据通过 `FileMetadataStore` 抽象，Node 使用进程内实现。
- 第一阶段只预留后台文件任务投递能力，不实现 BullMQ、Cloudflare Queue 或自动过期任务 consumer。

## REST API

file module 使用 `/api/files` 作为资源集合，不提供 `/api/upload`、`/api/download` 这类顶层动作路径。

| Method | Path                       | 行为                   |
| ------ | -------------------------- | ---------------------- |
| POST   | `/api/files`               | 创建文件资源，上传文件 |
| GET    | `/api/files`               | 分页列出当前店铺文件   |
| GET    | `/api/files/{id}`          | 获取文件元数据         |
| GET    | `/api/files/{id}/download` | 下载文件               |
| DELETE | `/api/files/{id}`          | 删除文件               |

`GET /api/files/{id}/download` 返回二进制下载或重定向，不返回项目标准 JSON response。

全局 request policy 只对 `POST /api/files` 应用上传专用 timeout 和 body limit。其他 `/api/files` 或 `/api/files/{id}` 路径只走普通 API timeout，不套上传 body limit。

建议状态码：

- `200 OK`: Node 直接 stream 文件。
- `302 Found`: Cloudflare 跳转到短期签名 R2 custom domain URL。
- `404 Not Found`: 文件不存在、已删除或不属于当前 shop。
- `410 Gone`: 文件存在但已经过期。
- `413 Payload Too Large`: 文件超过限制。
- `415 Unsupported Media Type`: 文件类型不允许。

## Runtime Capability 边界

扩展 `src/app/runtime/capabilities.ts`，让 file module 只依赖抽象能力。

建议新增能力：

```ts
export interface FileStorage {
  put(input: FilePutInput): Promise<FileStoredObject>;
  open(input: FileOpenInput): Promise<FileReadableObject>;
  delete(input: FileDeleteInput): Promise<void>;
}

export interface FileDownloadResolver {
  resolve(
    input: FileDownloadInput,
  ): Promise<
    | { type: "stream"; body: ReadableStream; headers: HeadersInit }
    | { type: "redirect"; url: string; headers?: HeadersInit }
  >;
}

export type FileTask =
  | { type: "expire-file"; fileId: string }
  | { type: "delete-object"; fileId: string; storageKey: string };

export interface FileTaskDispatcher {
  dispatch(task: FileTask): Promise<void>;
}

export interface FileMetadataStore {
  create(file: FileMetadata): Promise<void>;
  findById(input: FileLookup): Promise<FileMetadata | null>;
  list(input: FileListInput): Promise<FileMetadataPage>;
  updateStatus(input: FileStatusUpdate): Promise<void>;
  delete(input: FileLookup): Promise<void>;
}

export type FileMetadataStoreFactory = (
  context: Context<AppEnv>,
) => FileMetadataStore;
export type FileStorageFactory = (context: Context<AppEnv>) => FileStorage;
export type FileDownloadResolverFactory = (
  context: Context<AppEnv>,
) => FileDownloadResolver;
export type FileTaskDispatcherFactory = (
  context: Context<AppEnv>,
) => FileTaskDispatcher;
```

`RuntimeCapabilityInstances` 增加：

```ts
fileMetadataStoreFactory: FileMetadataStoreFactory;
fileStorageFactory: FileStorageFactory;
fileDownloadResolverFactory: FileDownloadResolverFactory;
fileTaskDispatcherFactory: FileTaskDispatcherFactory;
```

注册位置：

- 第一阶段 `src/app/runtime/process/capabilities.ts`: 注册进程内 metadata store、local file storage 和 local stream download。
- 后续 Node runtime: 使用 Drizzle metadata store，并用 BullMQ 实现后台文件任务 dispatcher/consumer。
- 后续 Cloudflare runtime: 使用 Drizzle metadata store、R2 file storage、R2 custom-domain signed redirect，并用 Cloudflare Queue 实现后台文件任务 dispatcher/consumer。

`FileTaskDispatcher` 只负责投递强类型任务，不负责扫描过期数据或直接清理文件。未来的 scheduler、BullMQ worker 和 Cloudflare Queue consumer 是独立基础设施入口。

业务层规则：

- `app/modules/file/*` 只调用 capability。
- 不在 service/controller 中写 `if APP_RUNTIME === "node"`。
- 不在共享业务代码中静态 import `node:*`、`pg`、R2-only SDK 或 Cloudflare-only helper。

## 建议目录

```text
apps/server/src/app/modules/file/
  constants.ts
  controller.ts
  index.ts
  meta.ts
  repository.ts
  schema.ts
  service.ts

apps/server/src/infra/database/
  client.ts
  drizzle.ts
  schema/files.ts

apps/server/src/infra/file-metadata/
  in-memory-file-metadata-store.ts

apps/server/src/infra/storage/
  cloudflare-r2-file-storage.ts
  file-storage.ts
  node-local-file-storage.ts
```

如实现时发现 `infra/database` 或 `infra/storage` 与现有 provider registry 更适合合并，应保持 provider/capability 边界，不为了目录而破坏 import graph。

## 数据库

数据库实现推迟到 Node 最小 demo 验证完成之后。第一阶段使用 `FileMetadataStore` 作为业务端口，并由 Node runtime 注册进程内实现。

进程内 metadata store 仅用于最小 demo 和单元测试：

- Node 进程重启后元数据丢失。
- 不适用于多实例部署。
- 不作为生产存储方案。
- 后续 Drizzle repository 应实现相同 `FileMetadataStore` 接口，替换时不修改 file service/controller。

Drizzle schema 建议：

```text
files
- id text primary key
- shop_domain text not null
- original_name text not null
- safe_name text not null
- content_type text not null
- byte_size bigint not null
- checksum_sha256 text
- storage_provider text not null
- storage_key text not null unique
- status text not null
- expires_at timestamptz not null
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz
```

字段约定：

- `storage_provider`: `local` 或 `r2`。
- `status`: `uploading`、`available`、`expired`、`deleted`、`failed`。
- `shop_domain`: 所有文件必须绑定当前 Shopify shop。
- `original_name`: 用户展示用，不能参与路径拼接。
- `safe_name`: 服务端清洗后的文件名，只作为路径尾部展示辅助。
- `storage_key`: 服务端生成的真实存储 key。

推荐索引：

```sql
create index files_shop_created_idx on files (shop_domain, created_at desc);
create index files_expiry_idx on files (status, expires_at) where deleted_at is null;
create unique index files_storage_key_idx on files (storage_provider, storage_key);
```

数据库 provider 规则：

```text
APP_RUNTIME=node       -> 默认 postgres
APP_RUNTIME=cloudflare -> 默认 neon
APP_RUNTIME=node + APP_DATABASE_PROVIDER=neon -> 使用 neon
```

建议 env：

```text
APP_DATABASE_PROVIDER=postgres | neon
APP_DATABASE_URL=...
APP_FILE_UPLOAD_TIMEOUT=300000
APP_FILE_DIR=files
APP_FILE_EXPIRE=86400000
APP_FILE_MAX_SIZE=10485760
APP_FILE_R2_BUCKET_NAME=...
APP_FILE_R2_CUSTOM_DOMAIN=https://files.example.com
APP_FILE_R2_HMAC_SECRET=...
```

## 文件存储

Node local storage：

```text
apps/server/public/files/{shopDomain}/{yyyy}/{mm}/{fileId}/{safeName}
```

Cloudflare R2 storage：

```text
shops/{shopDomain}/files/{yyyy}/{mm}/{fileId}/{safeName}
```

安全规则：

- 文件路径只使用服务端生成的 `fileId` 和 `storageKey`。
- 原始文件名只做展示。
- 清理 `../`、控制字符、路径分隔符和超长文件名。
- 默认所有文件私有。
- 下载前必须校验 Shopify session 和 `shopDomain` 归属。
- 对外错误不要暴露真实磁盘路径或 R2 key。

## 上传策略

推荐优先支持 streaming-friendly 请求：

```text
POST /api/files
Content-Type: application/pdf
X-File-Name: invoice.pdf
```

multipart 可以作为兼容路径，但大文件必须走 stream，避免将完整文件读入内存。

实现约束：

- 不使用 `await request.text()` 读取上传体。
- 不使用 `await file.arrayBuffer()` 处理大文件。
- 必须按 stream 计数限制 `APP_FILE_MAX_SIZE`。
- 可选计算 SHA-256 checksum，但必须使用 streaming hash 或分平台能力，不能强制缓存完整文件。
- 上传失败时需要删除已经写入的本地文件或 R2 object，并将 DB 记录标记为 `failed`。

## 下载策略

Node：

1. 根据 `shopDomain` 和 `id` 查询 DB。
2. 校验 `status=available` 且 `expires_at > now()`。
3. 从 local storage 打开 stream。
4. 返回 `200` binary response。

Node download headers：

```text
Content-Type: <file.contentType>
Content-Length: <file.byteSize>
Content-Disposition: attachment; filename*=UTF-8''<encoded originalName>
Cache-Control: private, no-store
```

Cloudflare：

1. 根据 `shopDomain` 和 `id` 查询 DB。
2. 校验 `status=available` 且 `expires_at > now()`。
3. 生成短期签名 custom-domain URL。
4. 返回 `302`。

R2 custom domain 短期签名注意事项：

- R2 S3 presigned URL 只适用于 S3 API domain，不适用于 custom domain。
- custom domain 短期签名应使用 Cloudflare WAF HMAC validation 或等价边缘校验能力。
- 如果不使用 WAF HMAC，则只能选择 S3 presigned URL 或 Worker 代理 stream，不能同时满足 custom domain 与 S3 presigned URL。

## 过期清理

默认过期时间是 24 小时，即 `APP_FILE_EXPIRE=86400000`。

Node：

- 后续通过 scheduler 扫描过期文件，并向 BullMQ 投递强类型 file task。
- BullMQ consumer 删除本地文件并更新 metadata 状态。
- process exit disposer 必须关闭 BullMQ connection、worker 和 scheduler。

Cloudflare：

- 使用 Worker scheduled handler 扫描过期文件并投递 Cloudflare Queue 消息。
- Cloudflare Queue consumer 删除过期 R2 object 并更新 metadata 状态。
- R2 lifecycle 可以作为存储侧兜底，但不能代替 DB 状态清理。

请求时惰性保护：

- 如果下载或读取元数据时发现文件已过期，返回 `410 Gone`。
- 可以通过 `ctx.executionCtx.waitUntil(...)` 或等价 capability 异步触发清理，但 promise 必须显式挂到 runtime 上，不能 floating。

## 性能与稳定性

- 所有大文件路径必须 streaming。
- 数据库查询只选择必要字段。
- 列表接口使用 cursor pagination，不使用大 offset。
- Node PostgreSQL client 使用 pool，并在 provider disposer 中关闭。
- Cloudflare 使用 Neon HTTP driver 或适合 Workers 的 serverless driver。
- 不在 module-level 存放请求态 mutable state。
- 所有后台 promise 必须 `await`、`return` 或交给 runtime waitUntil。
- 所有 provider/capability 长生命周期资源必须有 disposer。

## 后续实现顺序

### 第一阶段：Node 最小可执行 demo

1. 定义 `FileMetadataStore`、`FileStorage`、`FileDownloadResolver` 和 `FileTaskDispatcher` 端口。
2. 将必要 factory 加入 runtime capability；`FileTaskDispatcher` 第一阶段只保留类型口子，不注册或调用。
3. 实现 Node 进程内 metadata store。
4. 实现 Node local storage 和 local stream download。
5. 实现最小 file service/controller/meta，并注册 REST routes。
6. 实现请求时过期判断；第一阶段不实现后台自动清理。
7. 添加最小单元测试和 Node 可执行闭环测试。

第一阶段明确不做：

- Drizzle、PostgreSQL、Neon 和 migration。
- BullMQ、Cloudflare Queue、scheduled consumer。
- Cloudflare R2 和 custom-domain signed redirect。
- 生产级多实例一致性。

### 后续阶段

1. 用 Drizzle `FileMetadataStore` 替换进程内实现。
2. 为 Node 接入 BullMQ file task dispatcher、scheduler 和 consumer。
3. 为 Cloudflare 接入 R2、signed redirect、Cloudflare Queue 和 scheduled handler。
4. 完成跨 runtime、安全、性能和故障恢复测试。

## 相关文件

- `src/app/runtime/capabilities.ts`
- `src/app/runtime/process/capabilities.ts`
- `src/app/runtime/isolate/cloudflare/capabilities.ts`
- `src/app/bootstrap/register-routes.ts`
- `src/shared/middlewares/upload.ts`
- `src/infra/env`
