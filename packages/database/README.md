# @shamt/database

`@shamt/database` is the workspace package for shared Drizzle PostgreSQL table
definitions, Drizzle-Zod schemas, and inferred database types.

Applications should import schema objects from this package and create their own
runtime-specific Drizzle clients. This package does not open database
connections and does not read environment variables.

## Exports

| Entry                          | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `@shamt/database`              | Models, Drizzle-Zod schemas, and types |
| `@shamt/database/models`       | Drizzle table models only              |
| `@shamt/database/package.json` | Package metadata                       |

## Models

`users`

| Column       | Type      | Notes           |
| ------------ | --------- | --------------- |
| `id`         | serial    | primary key     |
| `name`       | text      | required        |
| `email`      | text      | required        |
| `created_at` | timestamp | defaults to now |

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

## Zod Schemas

The package exports Drizzle-Zod schemas for inserts and selects:

```ts
import {
  insertFileSchema,
  selectFileSchema,
  insertUserSchema,
  selectUserSchema,
} from "@shamt/database";
```

It also exports inferred types such as `InsertFile`, `SelectFile`,
`InsertUser`, and `User`.

## Usage

Create a Drizzle client in an app and pass the shared schema:

```ts
import { files, users } from "@shamt/database";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.APP_DATABASE_URL });
const db = drizzle({
  client: pool,
  schema: {
    files,
    users,
  },
});
```

Use models in queries:

```ts
import { files } from "@shamt/database";
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
- D1 is not implemented in this package yet; the current schema uses
  `drizzle-orm/pg-core`.
