# @shamt/database

`@shamt/database` is the workspace package for shared Drizzle table
definitions, Drizzle-Zod schemas, and inferred database types.

Applications should import schema objects from this package and create their own
runtime-specific Drizzle clients. This package does not open database
connections and does not read environment variables.

`apps/server` currently consumes these schemas through a runtime-aware database
factory. PostgreSQL models are used by Node PostgreSQL and Cloudflare
Hyperdrive. SQLite models are used by Cloudflare D1 and the Node D1 HTTP API
adapter.

## Exports

| Entry                                  | Purpose                                |
| -------------------------------------- | -------------------------------------- |
| `@shamt/database`                      | Models, Drizzle-Zod schemas, and types |
| `@shamt/database/models/postgres`      | PostgreSQL Drizzle table models        |
| `@shamt/database/models/sqlite`        | SQLite/D1 Drizzle table models         |
| `@shamt/database/sql-schemas/postgres` | PostgreSQL Drizzle-Zod schemas         |
| `@shamt/database/sql-schemas/sqlite`   | SQLite/D1 Drizzle-Zod schemas          |
| `@shamt/database/package.json`         | Package metadata                       |

## Models

The package keeps PostgreSQL and SQLite/D1 models separate because the two
dialects represent dates, booleans, enums, and integers differently. The app
layer maps both dialects behind the same store interfaces.

`files`

| Column            | Type        | Notes                          |
| ----------------- | ----------- | ------------------------------ |
| `id`              | text        | primary key                    |
| `shop_domain`     | text        | Shopify shop owner boundary    |
| `original_name`   | text        | uploaded filename for display  |
| `safe_name`       | text        | sanitized filename suffix      |
| `content_type`    | text        | uploaded MIME type             |
| `byte_size`       | bigint      | number mode, defaults to `0`   |
| `bucket_provider` | pg enum     | `memory` or `r2`               |
| `bucket_key`      | text        | generated object key           |
| `status`          | pg enum     | file lifecycle status          |
| `expires_at`      | timestamptz | expiry timestamp               |
| `created_at`      | timestamptz | creation timestamp             |
| `updated_at`      | timestamptz | update timestamp               |
| `deleted_at`      | timestamptz | nullable soft-delete timestamp |

File status values:

- `uploading`
- `available`
- `expired`
- `deleted`
- `failed`

File indexes:

- `files_shop_created_at_idx` on `shop_domain`, `created_at`
- `files_shop_status_idx` on `shop_domain`, `status`
- `files_expires_at_idx` on `expires_at`

The app-side file store uses `shop_domain`, `created_at`, and `id` for seek
pagination, and keeps page-number pagination shallow. Cursor requests avoid a
total-count query; page requests return `total` for the current filter.

`sqliteFiles`

SQLite/D1 file metadata table. It mirrors `files` with SQLite-compatible
types: enum values are stored as text, byte size as integer, and date columns as
integer `timestamp_ms` values.

`postgresShopifySessions`

PostgreSQL Shopify session table for
`@shopify/shopify-app-session-storage-drizzle`.

| Column                | Type      | Notes                       |
| --------------------- | --------- | --------------------------- |
| `id`                  | text      | primary key                 |
| `shop`                | text      | required                    |
| `state`               | text      | required                    |
| `isOnline`            | boolean   | required, defaults `false`  |
| `scope`               | text      | nullable                    |
| `expires`             | timestamp | nullable, date mode         |
| `accessToken`         | text      | required by adapter `4.0.0` |
| `userId`              | bigint    | nullable, number mode       |
| `firstName`           | text      | nullable                    |
| `lastName`            | text      | nullable                    |
| `email`               | text      | nullable                    |
| `accountOwner`        | boolean   | nullable                    |
| `locale`              | text      | nullable                    |
| `collaborator`        | boolean   | nullable                    |
| `emailVerified`       | boolean   | nullable                    |
| `refreshToken`        | text      | nullable                    |
| `refreshTokenExpires` | timestamp | nullable, date mode         |

`sqliteShopifySessions`

SQLite/D1 Shopify session table for
`@shopify/shopify-app-session-storage-drizzle`.

The columns mirror `postgresShopifySessions`, using SQLite-compatible column
types: boolean values are stored as integer booleans, `expires` values as text,
and `userId` as a bigint blob.

`productExports`

Product export job metadata table. PostgreSQL and SQLite/D1 variants mirror the
same logical shape and keep dialect-specific date/status storage inside their
own model files.

Key query indexes:

- `product_exports_shop_created_at_idx` on `shop_domain`, `created_at`
- `product_exports_shop_status_idx` on `shop_domain`, `status`
- `product_exports_shop_status_created_at_idx` on `shop_domain`, `status`, `created_at`

`productExportParts`

Product export part rows used by the export worker. The server store aggregates
part status counts in the database rather than loading every part into
application memory.

## Zod Schemas

The package exports Drizzle-Zod schemas for inserts and selects:

```ts
import {
  insertFileSchema,
  insertPostgresShopifySessionSchema,
  insertSqliteFileSchema,
  insertSqliteShopifySessionSchema,
  selectFileSchema,
  selectPostgresShopifySessionSchema,
  selectSqliteFileSchema,
  selectSqliteShopifySessionSchema,
} from "@shamt/database";
```

It also exports inferred types such as `InsertFile`, `SelectFile`,
`InsertSqliteFile`, `SelectSqliteFile`, `InsertPostgresShopifySession`,
`SelectPostgresShopifySession`, `InsertSqliteShopifySession`, and
`SelectSqliteShopifySession`.

## Usage

Create a Drizzle client in an app and pass the shared schema:

```ts
import {
  files,
  postgresShopifySessions,
} from "@shamt/database/models/postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.APP_DATABASE_URL });
const db = drizzle({
  client: pool,
  schema: {
    files,
    shopifySessions: postgresShopifySessions,
  },
});
```

Create a D1/SQLite Drizzle client with the SQLite schema:

```ts
import {
  sqliteFiles,
  sqliteShopifySessions,
} from "@shamt/database/models/sqlite";
import { drizzle } from "drizzle-orm/d1";

const db = drizzle(env.DB, {
  schema: {
    files: sqliteFiles,
    shopifySessions: sqliteShopifySessions,
  },
});
```

Use models in queries:

```ts
import { files } from "@shamt/database/models/postgres";
import { eq } from "drizzle-orm";

const rows = await db
  .select()
  .from(files)
  .where(eq(files.shopDomain, "example.myshopify.com"));
```

## Boundaries

- This package is schema-only.
- Runtime strategy belongs in apps, such as `apps/server/src/infra/database`.
- Migrations are generated from app-owned Drizzle config.
- File metadata has PostgreSQL and SQLite/D1 schemas.
- Shopify session storage has PostgreSQL and SQLite/D1 schemas.
- Node D1 support is implemented in the app layer by wrapping Cloudflare's D1
  HTTP API as a `D1Database`-compatible client.
