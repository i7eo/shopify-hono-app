# @shamt/app-env

`@shamt/app-env` is the app-level env package for this workspace. It composes
the runtime-neutral schemas from `@shamt/envs` with Shopify app fields, then
exports one validated `configSchema` for apps and build scripts.

Use this package when code needs the complete project env contract. Use
`@shamt/envs` directly only for lower-level constants or generic schemas.

## Exports

| Entry                         | Purpose                                                     |
| ----------------------------- | ----------------------------------------------------------- |
| `@shamt/app-env`              | `configSchema`, inferred types, app constants, envs exports |
| `@shamt/app-env/constants`    | Shopify constants plus re-exported base env constants       |
| `@shamt/app-env/package.json` | Package metadata                                            |

The root entry also re-exports `@shamt/envs`, so app code can import the
composed schema and shared constants from one place when that keeps call sites
clean.

## Schema

`configSchema` combines:

- base app defaults from `@shamt/envs`
- cache, database URL, Redis, logger, env, runtime, and file schemas
- Shopify app fields defined in this package
- app-level database provider fields
- bucket provider fields

Shopify fields:

| Field                         | Values / shape             |
| ----------------------------- | -------------------------- |
| `SHOPIFY_APP_MODE`            | `embedded` or `standalone` |
| `SHOPIFY_APP_FRONTEND_TARGET` | `frontend` or `backend`    |
| `SHOPIFY_APP_KEY`             | trimmed string             |
| `SHOPIFY_APP_SECRET`          | trimmed string             |
| `SHOPIFY_APP_URL`             | valid URL                  |
| `SHOPIFY_API_VERSION`         | trimmed string             |
| `SCOPES`                      | trimmed string             |
| `APP__SERVER_PORT`            | coerced number             |
| `APP__WEB_PORT`               | coerced number             |

App database fields:

| Field                   | Values / shape     |
| ----------------------- | ------------------ |
| `APP_DATABASE_PROVIDER` | `postgres` or `d1` |
| `APP_DATABASE_D1_URL`   | optional string    |
| `APP_DATABASE_D1_KEY`   | optional string    |
| `APP_DATABASE_D1_VALUE` | optional string    |

`postgres` is the implemented main path. `d1` and the D1 fields are reserved
for a future Cloudflare-stack database path.

Bucket fields:

| Field                 | Values / shape   |
| --------------------- | ---------------- |
| `APP_BUCKET_PROVIDER` | `memory` or `r2` |
| `APP_BUCKET_R2_URL`   | optional URL     |
| `APP_BUCKET_R2_KEY`   | optional string  |
| `APP_BUCKET_R2_VALUE` | optional string  |

`memory` is the Node development bucket provider. `r2` uses the S3-compatible
R2 configuration consumed by `apps/server`.

## Usage

Parse a complete app env object:

```ts
import { configSchema } from "@shamt/app-env";

const config = configSchema.parse(process.env);
```

Use constants without scattering string literals:

```ts
import {
  DEFAULT_APP_BUCKET_PROVIDERS,
  DEFAULT_APP_DATABASE_PROVIDERS,
  DEFAULT_RUNTIMES,
  DEFAULT_SHOPIFY_APP_FRONTEND_TARGETS,
  DEFAULT_SHOPIFY_APP_MODES,
} from "@shamt/app-env/constants";

const isCloudflare = config.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE;
const isEmbedded =
  config.SHOPIFY_APP_MODE === DEFAULT_SHOPIFY_APP_MODES.EMBEDDED;
const frontendTarget =
  config.SHOPIFY_APP_FRONTEND_TARGET ===
  DEFAULT_SHOPIFY_APP_FRONTEND_TARGETS.FRONTEND;
const usesPostgres =
  config.APP_DATABASE_PROVIDER === DEFAULT_APP_DATABASE_PROVIDERS.POSTGRES;
const usesR2 = config.APP_BUCKET_PROVIDER === DEFAULT_APP_BUCKET_PROVIDERS.R2;
```

## Boundaries

- This package defines and validates env shape; it does not read env files.
- Apps decide when to call `configSchema.parse(...)`.
- Browser code must not import full parsed env. `apps/web` filters public env
  through its Vite public env plugin before exposing values to `globalThis`.
