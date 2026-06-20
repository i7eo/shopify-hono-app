# Database

`apps/server/src/infra/database` 是 Shopify session storage 和 file metadata 共用的 runtime-aware database 层。它通过 `databaseFactory` capability 暴露 Drizzle client，让业务模块不直接关心 Node、D1、Hyperdrive 等平台差异。

## Provider 矩阵

数据库 provider 来自 `APP_DATABASE_PROVIDER`：

| Provider   | 值         | 说明                                              |
| ---------- | ---------- | ------------------------------------------------- |
| PostgreSQL | `postgres` | Node 使用 `pg`，Cloudflare 使用 Hyperdrive        |
| D1         | `d1`       | Node 使用 D1 HTTP API，Cloudflare 使用 D1 binding |

当前支持矩阵：

| Runtime      | APP_DATABASE_PROVIDER | 实现                                               | Cloudflare binding        |
| ------------ | --------------------- | -------------------------------------------------- | ------------------------- |
| `node`       | `postgres`            | `pg.Pool` + `drizzle-orm/node-postgres`            | 不需要                    |
| `node`       | `d1`                  | Cloudflare D1 HTTP API + `drizzle-orm/d1`          | 不需要                    |
| `cloudflare` | `postgres`            | Hyperdrive `connectionString` + PostgreSQL Drizzle | `APP_HYPERDRIVER_BINDING` |
| `cloudflare` | `d1`                  | Cloudflare D1 binding + `drizzle-orm/d1`           | `APP_DATABASE_D1_BINDING` |

`APP_DATABASE_PROVIDER` 缺省时按 `postgres` 处理。

## Runtime 实现

### Node + PostgreSQL

Node PostgreSQL 通过 `pg.Pool` 连接数据库：

```text
APP_RUNTIME=node
APP_DATABASE_PROVIDER=postgres
APP_DATABASE_URL=postgresql://...
```

对应实现：

```text
apps/server/src/infra/database/process.ts
apps/server/src/infra/database/shared.ts
```

数据库连接会缓存在 process runtime 中，并在 runtime capability disposer 中释放。

### Node + D1 HTTP

Node D1 不使用 Worker D1 binding，而是通过 Cloudflare D1 HTTP API 访问：

```text
APP_RUNTIME=node
APP_DATABASE_PROVIDER=d1
APP_CLOUDFLARE_WORKER_ACCOUNT_ID=...
APP_CLOUDFLARE_USER_TOKEN=...
APP_DATABASE_D1_ID=...
```

对应实现：

```text
apps/server/src/infra/database/process.d1-http.ts
```

这个实现把 D1 HTTP API 包装成兼容 `drizzle-orm/d1` 的 `D1Database` 形状，因此上层仍然可以使用 SQLite schema。

`infra/database/index.ts` 使用 `PROCESS_DATABASE_MODULE = "./process"` 和
`ISOLATE_DATABASE_MODULE = "./isolate"` 动态 import runtime 实现，并暴露
`disposeDatabase(...)`。process PostgreSQL/D1 HTTP 可以缓存连接或 client；
isolate D1/Hyperdrive 当前以 request binding 为边界，disposer 是 no-op。

### Cloudflare + PostgreSQL

Cloudflare PostgreSQL 通过 Hyperdrive 取得 `connectionString`：

```text
APP_RUNTIME=cloudflare
APP_DATABASE_PROVIDER=postgres
APP_HYPERDRIVER_BINDING=i7eo_shopify_app_hyperdrive
```

`wrangler.json` 中会生成：

```json
{
  "hyperdrive": [
    {
      "binding": "i7eo_shopify_app_hyperdrive",
      "id": "..."
    }
  ]
}
```

runtime capability 会通过 `APP_HYPERDRIVER_BINDING` 动态读取 `c.env[binding]`，并在使用点强校验。

### Cloudflare + D1

Cloudflare D1 通过 Worker D1 binding 访问：

```text
APP_RUNTIME=cloudflare
APP_DATABASE_PROVIDER=d1
APP_DATABASE_D1_BINDING=i7eo_shopify_app_d1
APP_DATABASE_D1_ID=...
```

`wrangler.json` 中会生成：

```json
{
  "d1_databases": [
    {
      "binding": "i7eo_shopify_app_d1",
      "database_name": "i7eo-shopify-app-d1",
      "database_id": "...",
      "migrations_dir": "drizzle.d1"
    }
  ]
}
```

runtime capability 会通过 `APP_DATABASE_D1_BINDING` 动态读取 `c.env[binding]`。

## Schema 与迁移目录

PostgreSQL 和 D1 使用不同 schema 输出，但业务 store 保持同一接口。

| Provider   | Drizzle config                     | Migration dir            | Schema package                          |
| ---------- | ---------------------------------- | ------------------------ | --------------------------------------- |
| PostgreSQL | `apps/server/drizzle.pg.config.ts` | `apps/server/drizzle.pg` | `packages/database/src/models/postgres` |
| D1         | `apps/server/drizzle.d1.config.ts` | `apps/server/drizzle.d1` | `packages/database/src/models/sqlite`   |

file metadata store 使用：

```text
apps/server/src/app/modules/file/stores/database/index.ts
apps/server/src/app/modules/file/stores/database/postgres.ts
apps/server/src/app/modules/file/stores/database/sqlite.ts
apps/server/src/app/modules/file/stores/database/shared.ts
packages/database/src/models/postgres/files.ts
packages/database/src/models/sqlite/files.ts
```

product export store 使用：

```text
apps/server/src/app/modules/product-export/stores/database/index.ts
apps/server/src/app/modules/product-export/stores/database/postgres.ts
apps/server/src/app/modules/product-export/stores/database/sqlite.ts
apps/server/src/app/modules/product-export/stores/database/shared.ts
packages/database/src/models/postgres/product-exports.ts
packages/database/src/models/sqlite/product-exports.ts
```

模块 store 约定：

- `index.ts` 只负责根据 Drizzle database kind 选择 dialect store。
- `postgres.ts` 和 `sqlite.ts` 放置 SQL dialect-specific 查询、排序、聚合和事务逻辑。
- `shared.ts` 放置分页转换、cursor 解析、page offset、状态统计转换等跨 dialect 逻辑。
- Cursor 列表使用 `created_at + id` seek cursor，多取一条记录判断 `hasNext`；page 列表只允许浅页导航，并额外计算 `total`。

Shopify session storage 使用：

```text
packages/database/src/models/postgres/shopify-sessions.ts
packages/database/src/models/sqlite/shopify-sessions.ts
```

## Server package commands

数据库相关命令定义在 `apps/server/package.json`：

| Command                 | 作用                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `db:pg:push`            | 使用 `.env.development` 和 `drizzle.pg.config.ts` push PostgreSQL schema |
| `db:d1:push`            | 使用 `.env.development` 和 `drizzle.d1.config.ts` push D1 schema         |
| `db:pg:generate`        | 根据 PostgreSQL schema 生成 migration 到 `drizzle.pg`                    |
| `db:d1:generate`        | 根据 SQLite/D1 schema 生成 migration 到 `drizzle.d1`                     |
| `db:pg:migrate`         | 使用 `.env.production` 执行 PostgreSQL migration                         |
| `db:d1:migrate`         | 使用 Wrangler 对远端 D1 执行 migration                                   |
| `db:pg:seed:dev`        | 使用 `.env.development` 写入 development PostgreSQL seed 数据            |
| `db:pg:seed:prod`       | 使用 `.env.production` 写入 production PostgreSQL seed 数据              |
| `db:d1:seed:dev`        | 使用 `.env.development` 调用 Wrangler 写入 development 本地 D1 seed      |
| `db:d1:seed:dev:remote` | 使用 `.env.development` 调用 Wrangler 写入 development 远端 D1 seed      |
| `db:d1:seed:prod`       | 使用 `.env.production` 调用 Wrangler 写入 production 远端 D1 seed        |

常用命令：

```bash
pnpm --dir apps/server run db:pg:generate
pnpm --dir apps/server run db:d1:generate
pnpm --dir apps/server run db:pg:migrate
pnpm --dir apps/server run db:d1:migrate
pnpm --dir apps/server run db:pg:seed:dev
pnpm --dir apps/server run db:d1:seed:dev
```

### Seed 参数

Seed 脚本会复用 `apps/server/scripts/database/env.ts` 的校验逻辑：

| 参数                | 作用                                                      |
| ------------------- | --------------------------------------------------------- |
| `CONFIRM_PROD_SEED` | production seed 的显式确认开关，值必须为 `true`           |
| `D1_SEED_REMOTE`    | D1 seed 是否传 `--remote` 给 Wrangler，值为 `true` 时启用 |
| `D1_WRANGLER_ENV`   | D1 seed 传给 Wrangler 的 `--env` 值，例如 `production`    |

`CONFIRM_PROD_SEED` 只保护 seed，不保护 generate/migrate。原因是 seed 会写入业务数据，而 production seed 当前会写入固定的测试/初始化记录，例如 `seed-shop.myshopify.com`。production seed 必须通过命令显式传入：

```bash
CONFIRM_PROD_SEED=true
```

如果没有这个确认，`.env.production` 下执行 `seed.pg.ts` 或 `seed.d1.ts` 会直接失败。

D1 seed 默认写本地 D1：

```bash
pnpm --dir apps/server run db:d1:seed:dev
```

写 development 远端 D1 时使用：

```bash
pnpm --dir apps/server run db:d1:seed:dev:remote
```

这个命令会设置：

```bash
D1_SEED_REMOTE=true
```

写 production 远端 D1 时使用：

```bash
pnpm --dir apps/server run db:d1:seed:prod
```

这个命令会同时设置：

```bash
CONFIRM_PROD_SEED=true
D1_SEED_REMOTE=true
D1_WRANGLER_ENV=production
```

## 与 Wrangler 生成器的关系

`scripts/write-wrangler-file` 只在 Cloudflare runtime 需要数据库 binding 时生成数据库配置：

| Runtime      | Provider   | Wrangler 数据库配置 |
| ------------ | ---------- | ------------------- |
| `node`       | `postgres` | 不生成              |
| `node`       | `d1`       | 不生成              |
| `cloudflare` | `postgres` | 生成 `hyperdrive`   |
| `cloudflare` | `d1`       | 生成 `d1_databases` |

Node + D1 虽然需要 `APP_DATABASE_D1_ID` 和 Cloudflare token，但它不需要 Worker D1 binding。Cloudflare + D1 需要 `APP_DATABASE_D1_ID` 生成 `d1_databases`。

## 使用边界

- 业务模块不要直接创建 `pg.Pool`、D1 client 或 Hyperdrive client。
- Shopify session storage 和 file store 都应通过 `databaseFactory` 获取 database。
- Cloudflare binding 字段不要写死在业务代码里，必须通过 `APP_DATABASE_D1_BINDING` 或 `APP_HYPERDRIVER_BINDING` 动态读取。
- 迁移目录 `drizzle.pg` / `drizzle.d1` 是生成产物目录，lint 会跳过目录内容，但仍会校验 `drizzle.*.config.ts`。
