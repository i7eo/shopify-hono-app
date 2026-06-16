# Bucket

`apps/server/src/infra/bucket` 是 file module 使用的 runtime-aware object bucket 层。它暴露一个很小的 `Bucket` 接口，并通过 `createBucket(config)` 隐藏 provider 细节。

## 接口

```ts
export interface Bucket {
  put: (input: BucketPutInput) => Promise<BucketStoredObject>;
  open: (input: BucketOpenInput) => Promise<BucketReadableObject>;
  delete: (input: BucketDeleteInput) => Promise<void>;
}

export interface BucketDownloadSigner {
  signDownloadUrl: (input: BucketDownloadSignInput) => Promise<string>;
}
```

`put` 接收 `ReadableStream<Uint8Array>`，在 streaming 写入时统计字节数，并在超过 `APP_FILE_MAX_SIZE` 时返回 payload-too-large。

## Providers

Provider 值来自 `APP_BUCKET_PROVIDER`：

| Provider | 值       | Runtime 支持               |
| -------- | -------- | -------------------------- |
| Memory   | `memory` | 仅 Node                    |
| R2       | `r2`     | Node 和 Cloudflare runtime |

Runtime-aware 默认值：

| Runtime      | 默认 provider |
| ------------ | ------------- |
| `node`       | `memory`      |
| `cloudflare` | `r2`          |

Cloudflare 只接受 `r2` provider。Node 接受 `memory` 和 `r2`。

## Process Memory Bucket

`ProcessMemoryBucket` 把文件存储在：

```text
{process.cwd()}/public/{APP_FILE_DIR}/{bucketKey}
```

在 server app 中会解析为：

```text
apps/server/public/files/{shopDomain}/{yyyy}/{mm}/{fileOrBatchId}/{safeName}
```

bucket 在触碰磁盘前会把每个 key 规范化并解析到配置的 root 目录下。任何试图逃逸 root 的 key 都会被拒绝。

上传使用 `node:stream/promises.pipeline`、`Readable.fromWeb` 和 `createWriteStream(..., { flags: "wx" })`。写入失败或超出大小限制时，会删除已经部分写入的文件。

## S3-Compatible R2 Bucket

`S3CompatibleBucket` 是 Node 和 Cloudflare 在 `r2` provider 下共用的实现。它使用 `@aws-sdk/client-s3`，配置为：

```text
region: auto
forcePathStyle: true
```

必需 env：

| Env                   | 说明                              |
| --------------------- | --------------------------------- |
| `APP_BUCKET_R2_URL`   | 带 bucket path 的 S3 endpoint URL |
| `APP_BUCKET_R2_KEY`   | R2 access key ID                  |
| `APP_BUCKET_R2_VALUE` | R2 secret access key              |

`APP_BUCKET_R2_URL` 必须在 path 中包含 bucket name：

```text
https://<account-id>.r2.cloudflarestorage.com/<bucket-name>
```

解析后会得到：

```text
endpoint: https://<account-id>.r2.cloudflarestorage.com
bucketName: <bucket-name>
```

R2 download 使用 `S3CompatibleBucketDownloadSigner` 和 `@aws-sdk/s3-request-presigner` 生成短期 `GetObjectCommand` 签名 URL。签名 URL 默认由 file module 使用 `300000ms` TTL，并带上：

```text
ResponseContentType: <file.contentType>
ResponseContentDisposition: attachment; filename*=UTF-8''<encoded originalName>
```

## Runtime Upload Body Adapters

S3 bucket 会接收一个 runtime-specific upload body adapter：

| Runtime | Adapter 行为                                                                  |
| ------- | ----------------------------------------------------------------------------- |
| Node    | 将 Web stream 转成 Node `Readable`，并通过 byte-counting `Transform` 管道传递 |
| Isolate | 通过 Web `TransformStream` 管道传递，并在 S3 upload 前统计字节数              |

两个 adapter 都会暴露 `getByteLength()`，让 `put` 可以在上传完成后返回实际存储字节数。

## 当前边界

- R2 当前在两个 runtime 中都使用 S3-compatible API，以保持一致性。
- R2 custom-domain signed download 尚未实现；当前返回 S3-compatible endpoint 的短期签名 URL。
- 生命周期清理不在这里实现。后续 BullMQ 或 Cloudflare Queue consumer 应调用 `bucket.delete(...)`。

## 测试

常用聚焦检查：

```bash
pnpm --dir apps/server exec vitest run \
  tests/bucket-strategy.test.ts \
  tests/process-memory-bucket.test.ts \
  tests/isolate-s3-compatible-bucket.test.ts
```
