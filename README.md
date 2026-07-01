# Shopify Hono App

This repository contains a Shopify app built with Hono, Shopify CLI, Wrangler,
React, Vite, and a small set of shared TypeScript packages. The app supports
both Shopify `embedded` and `standalone` modes, and can run the server through
either a Node process or Cloudflare Workers.

It is organized as a pnpm monorepo. The app code lives under `apps/`, reusable
runtime libraries live under `packages/`, and root scripts coordinate Shopify
configuration, Cloudflare Tunnel, local development, formatting, linting, and
deployment.

## Workspace

### Apps

These packages are private application entry points.

| Package                                     | Version | Description                                                                                |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| [`@shamt/server`](./apps/server#readme)     | `0.0.0` | Hono app for Shopify auth, app shell fallback, API routes, webhooks, and runtime adapters. |
| [`@shamt/web`](./apps/web#readme)           | `0.0.0` | React and Vite frontend target for Shopify app shell UI.                                   |
| [`@shamt/document`](./apps/document#readme) | `0.0.0` | VitePress documentation app workspace.                                                     |

### Shared Runtime Packages

These packages provide reusable framework-neutral building blocks for the apps.

| Package                                         | Version | Description                                                              |
| ----------------------------------------------- | ------- | ------------------------------------------------------------------------ |
| [`@shamt/envs`](./packages/envs#readme)         | `0.0.0` | Base constants and Zod schemas for runtime-neutral environment config.   |
| [`@shamt/app-env`](./packages/app-env#readme)   | `0.0.0` | App-specific env schema that composes `@shamt/envs` with Shopify fields. |
| [`@shamt/database`](./packages/database#readme) | `0.0.0` | Shared Drizzle models, Drizzle-Zod schemas, and inferred database types. |

External shared libraries such as `@unimolecule/utils` and
`@unimolecule/oh-my-fetch` provide generic runtime-neutral utilities and the
shared HTTP client used by app and package code.

## Architecture

The dependency direction is intentionally one-way:

```text
@unimolecule/utils
  -> @unimolecule/oh-my-fetch
@shamt/envs
  -> @shamt/app-env / @shamt/database
shared packages + external libraries
  -> apps/server / apps/web
  -> Shopify Admin API / Shopify App Bridge / Cloudflare Workers
```

### Request flow

`@shamt/envs` centralizes base constants and Zod schemas, but it does not read
from `process.env` or Cloudflare bindings directly. `@shamt/app-env` composes
those base schemas with Shopify app fields such as `SHOPIFY_APP_MODE` and
`SHOPIFY_APP_FRONTEND_TARGET`.

### Key design decisions

`@unimolecule/oh-my-fetch` wraps `ky` for consistent HTTP behavior across
services: query serialization, body handling, timeout, retry, response parsing,
schema validation, normalized request errors, and optional plugins imported from
explicit subpath entrypoints.

`apps/server` composes the shared packages with Hono, Shopify API libraries,
Cloudflare Workers bindings, LogTape logging, and Shopify app routes. It has two
runtime entries:

| Method | Path                                       | Auth                  | Description                           |
| ------ | ------------------------------------------ | --------------------- | ------------------------------------- |
| `GET`  | `/auth`                                    | None                  | Starts OAuth install flow             |
| `GET`  | `/auth/callback`                           | HMAC-verified         | Completes OAuth, stores offline token |
| `GET`  | `/app`                                     | `ensureInstalled`     | Serves embedded app HTML shell        |
| `GET`  | `/api/shop`                                | Shopify Admin session | Returns shop name, email, domain      |
| `GET`  | `/api/product`                             | Shopify Admin session | Lists products from Admin GraphQL     |
| `GET`  | `/api/files`                               | Shopify Admin session | Lists uploaded file metadata          |
| `GET`  | `/api/product-exports`                     | Shopify Admin session | Lists product export jobs             |
| `GET`  | `/api/product-exports/reference/templates` | Shopify Admin session | Lists product export templates        |
| `GET`  | `/api/reference/gender`                    | Shopify Admin session | Lists gender reference data           |
| `POST` | `/webhooks/app/uninstalled`                | Webhook HMAC          | Cleans up session on uninstall        |
| `POST` | `/webhooks/customers/data-request`         | Webhook HMAC          | GDPR customer data request            |
| `POST` | `/webhooks/customers/redact`               | Webhook HMAC          | GDPR customer data deletion           |
| `POST` | `/webhooks/shop/redact`                    | Webhook HMAC          | GDPR shop data deletion               |
| `GET`  | `/health`                                  | None                  | Health check                          |

## App Runtime

The server app provides:

- Shopify OAuth and callback handling.
- Shopify app shell rendering or redirect fallback.
- Embedded session-token verification and token exchange middleware.
- Standalone account-session cookie handling.
- Admin GraphQL-backed shop and product API routes.
- Shopify webhook endpoints.
- Node PostgreSQL and Cloudflare D1-backed Shopify session storage integration.
- Health checks and OpenAPI route registration.
- Cloudflare Worker and Node process runtime adapters.

The frontend target is controlled by `SHOPIFY_APP_FRONTEND_TARGET`:

| Target     | Behavior                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| `backend`  | `apps/server` owns the Shopify `frontend` and `backend` web roles.        |
| `frontend` | `apps/web` owns the Shopify `frontend` role; server keeps backend routes. |

The Shopify admin UI uses Shopify Polaris web components. Embedded app shells
load App Bridge and Polaris; standalone shells load Polaris only:

```html
<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
<script src="https://cdn.shopify.com/shopifycloud/polaris.js"></script>
```

Admin UI markup should use Polaris web components such as `<s-page>`,
`<s-section>`, `<s-banner>`, `<s-spinner>`, and `<s-text>`.

## Local Development

### Requirements

- Node.js `26.2.0`, as declared in [`pnpm-workspace.yaml`](./pnpm-workspace.yaml).
- pnpm with workspace protocol support.
- Shopify CLI from the root dev dependencies.
- Wrangler from the root dev dependencies.
- A Shopify Partner account and development store.
- Optional: a Cloudflare account with the `sofary` named tunnel configured when
  using the fixed development hostname.

Install dependencies:

```bash
pnpm install
```

### Environment Files

Development values are read from `.env.development`. Production values are read
from `.env.production`.

The development file should include:

```dotenv
APP_ENV=development
APP_RUNTIME=node
APP__SERVER_PORT=10001
APP__WEB_PORT=10002

SHOPIFY_APP_MODE=embedded
SHOPIFY_APP_FRONTEND_TARGET=frontend
SHOPIFY_APP_KEY=...
SHOPIFY_APP_SECRET=...
SHOPIFY_APP_URL=https://i7eo-shopify-app.i7eo.com
SHOPIFY_API_VERSION=2026-04
SCOPES=read_products,write_products,read_orders
```

The root preparation scripts write generated platform configuration from the
selected env file before local dev or deploy:

```bash
pnpm dev:prepare
pnpm deploy:prepare
```

`dev:prepare` loads `.env.development`; `deploy:prepare` loads
`.env.production`. Each command runs two focused generators:

| Generator                     | Output                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `scripts/write-shopify-file`  | `shopify.app*.toml` and Shopify web role files.                                               |
| `scripts/write-wrangler-file` | `apps/server/wrangler.json` for the active `APP_ENV`, runtime, database provider, and bucket. |

Wrangler configuration is generated from `APP_ENV`, `APP_RUNTIME`,
`APP_DATABASE_PROVIDER`, and `APP_BUCKET_PROVIDER`. Development Cloudflare
resources use the `i7eo-shopify-app-dev-*` name family, while production keeps
the `i7eo-shopify-app-*` family. For example, `node + postgres + r2` generates
only an R2 binding because Node PostgreSQL does not need a Cloudflare database
binding.

Generated `wrangler.json` intentionally does not include `vars`. Local
Cloudflare dev reads runtime values from `.env.development` via Wrangler's
`--env-file`; production deploy bulk-loads `.env.production` into the selected
Wrangler environment before `wrangler deploy`.

See [`apps/server/docs/reference/wrangler.md`](./apps/server/docs/reference/wrangler.md) for the
generation matrix and implementation details.

`scripts/write-shopify-file` deletes existing `shopify.web.toml` files first,
then writes `apps/server/shopify.web.toml` and, when
`SHOPIFY_APP_FRONTEND_TARGET=frontend`, `apps/web/shopify.web.toml`.

After linking, find your **Client Secret** in the [Shopify Dev Dashboard](https://dev.shopify.com/) under your app's **Client credentials** section — you'll need it for the next steps.

### 3. Configure Cloudflare resources

```bash
pnpm --dir apps/server wrangler r2 bucket create i7eo-shopify-app-dev-r2
pnpm --dir apps/server wrangler d1 create i7eo-shopify-app-dev-d1
```

Copy generated D1 IDs into `.env.development` or `.env.production`.
`apps/server/wrangler.json` is generated by prepare scripts; do not edit
Cloudflare bindings there by hand unless you are intentionally debugging
generated output.

### 4. Configure environment variables

Edit `.env.development` with the development values shown above. The important
Shopify fields are:

```dotenv
SHOPIFY_APP_KEY=your_app_client_id
SHOPIFY_APP_SECRET=your_app_client_secret
SHOPIFY_APP_URL=https://your-development-url.example.com
SCOPES=read_products,write_products,read_orders
```

`pnpm dev:prepare` reads `.env.development` and regenerates Shopify and
Wrangler config before local development starts.

### 5. Update shopify.app.toml

Edit [shopify.app.toml](shopify.app.toml) with your app's `client_id`. The `application_url` and `redirect_urls` are updated automatically by Shopify CLI during `shopify app dev`.

## Development

### How Shopify CLI starts the runtime

Local development starts from generated Shopify web role files. The server web
role is always written to `apps/server/shopify.web.toml`; when
`SHOPIFY_APP_FRONTEND_TARGET=frontend`, a frontend web role is also written to
`apps/web/shopify.web.toml`.

The server command in `apps/server/shopify.web.toml` is selected from
`APP_RUNTIME`:

| `APP_RUNTIME` | Generated dev command |
| ------------- | --------------------- |
| `cloudflare`  | `pnpm cf:dev`         |
| `node`        | `pnpm node:dev`       |

For example, Cloudflare runtime generates:

```toml
roles = ["backend"]
port = 10001

[commands]
dev = "pnpm cf:dev"
build = "pnpm cf:deploy"
```

When you run `pnpm dev`, the root script regenerates config and then starts
Shopify CLI:

1. `pnpm dev:prepare` reads `.env.development` and rewrites generated TOML.
2. Shopify CLI reads the generated web role files.
3. Shopify CLI injects runtime values such as `BACKEND_PORT`, `APP_URL`, and
   `HOST`.
4. The generated server command starts either `cf:dev` or `node:dev`.
5. The server command maps Shopify CLI values into the app env expected by the
   selected runtime.

### Development Tunnel

The default local development flow uses Shopify CLI's autogenerated quick
tunnel:

```bash
pnpm dev
```

Use the named Cloudflare Tunnel `sofary` only when you need the fixed public
hostname:

```text
https://i7eo-shopify-app-dev.i7eo.com
```

For the named tunnel flow, Cloudflare Zero Trust must point the Public Hostname
for `i7eo-shopify-app-dev.i7eo.com` to the Shopify CLI local proxy:

```text
http://[::1]:10101
```

The local port split is unchanged:

| Port    | Owner       | Purpose                               |
| ------- | ----------- | ------------------------------------- |
| `10101` | Shopify CLI | Local proxy for the custom tunnel URL |
| `10001` | apps/server | Node or Wrangler development server   |
| `10002` | apps/web    | Vite development server when enabled  |

When using `shopify app dev --tunnel-url=...`, keep the
`shopifyProxyPort` and `tunnelName` constants in
[`scripts/tunnel/index.ts`](./scripts/tunnel/index.ts) aligned with the named
Cloudflare Tunnel. The `shopifyProxyPort` value must be unique: it cannot match
any root env variable whose name contains `port`, case-insensitively, such as
`APP__SERVER_PORT` or `APP__WEB_PORT`. The tunnel script fails before starting
child processes when a duplicate port is detected.

Start the fixed-hostname flow with:

```bash
pnpm dev:tunnel
```

The relevant root scripts are:

```json
{
  "dev": "pnpm dev:prepare && pnpm app:dev",
  "app:dev": "shopify app dev",
  "dev:tunnel": "pnpm dev:prepare && node --env-file=./.env.development --import tsx ./scripts/tunnel/index.ts"
}
```

Use `pnpm dev` for normal development so Shopify TOML files are regenerated
before Shopify CLI starts. `pnpm app:dev` is the raw Shopify CLI command and
uses Shopify CLI's quick tunnel. `pnpm dev:tunnel` regenerates Shopify TOML,
starts the `sofary` Cloudflare tunnel, waits for it to be ready, then starts
`shopify app dev --tunnel-url=<SHOPIFY_APP_URL>:10101`; it also stops both
child processes when the parent process exits.

Do not configure the tunnel service as `https://127.0.0.1:10101`; the Shopify
CLI proxy is plain HTTP.

| Variable             | Source                                                   |
| -------------------- | -------------------------------------------------------- |
| `SHOPIFY_APP_KEY`    | `.env.development`                                       |
| `SHOPIFY_APP_SECRET` | `.env.development`                                       |
| `APP_URL` / `HOST`   | The tunnel URL (e.g. `https://abc123.trycloudflare.com`) |
| `SCOPES`             | `.env.development`, written into `shopify.app.toml`      |
| `BACKEND_PORT`       | The server web role port injected by Shopify CLI         |

`cf:dev` reads `.env.development`, passes `BACKEND_PORT` to Wrangler's
`--port`, and forwards the current tunnel URL as `SHOPIFY_APP_URL`.
`node:dev` reads `.env.development`, maps `BACKEND_PORT` to
`APP__SERVER_PORT`, and maps `APP_URL` / `HOST` to `SHOPIFY_APP_URL`.

### Alternative: Localhost mode (stable URL)

Run the Shopify app locally:

```bash
pnpm dev
```

Run Shopify dev with the fixed Cloudflare Tunnel hostname:

```bash
pnpm dev:tunnel
```

### Root Package Scripts

Root scripts coordinate workspace-level development, deployment, formatting,
and cleanup.

| Script                    | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `postinstall`             | Installs simple-git-hooks after dependencies are installed.                |
| `dev:prepare`             | Runs all development prepare generators.                                   |
| `dev:prepare:shopify`     | Loads `.env.development` and regenerates Shopify app/web TOML files.       |
| `dev:prepare:wrangler`    | Loads `.env.development` and regenerates `apps/server/wrangler.json`.      |
| `app:dev`                 | Runs `shopify app dev` with Shopify CLI's autogenerated quick tunnel.      |
| `dev`                     | Runs `dev:prepare` and then `app:dev`.                                     |
| `dev:tunnel`              | Runs `dev:prepare`, starts the `sofary` tunnel, then runs Shopify app dev. |
| `deploy:prepare`          | Runs all production prepare generators.                                    |
| `deploy:prepare:shopify`  | Loads `.env.production` and regenerates production Shopify TOML files.     |
| `deploy:prepare:wrangler` | Loads `.env.production` and regenerates production Wrangler config.        |
| `deploy:runtime`          | Dispatches to the server deploy script for the active `APP_RUNTIME`.       |
| `app:deploy`              | Runs `shopify app deploy --config production`.                             |
| `deploy`                  | Runs prepare, runtime deploy, and Shopify app deploy in order.             |
| `format`                  | Runs each workspace package format script.                                 |
| `lint`                    | Runs each workspace package lint script.                                   |
| `clean`                   | Runs root cleanup tasks.                                                   |
| `clean:workspace`         | Runs each workspace package clean script.                                  |
| `clean:cache`             | Removes root dependency/cache files.                                       |
| `commit`                  | Starts the Commitizen prompt.                                              |
| `upgrade:pkgs`            | Opens recursive interactive package upgrades.                              |

Format all workspaces:

```bash
pnpm format
```

Lint all workspaces:

```bash
pnpm lint
```

Run server tests:

```bash
pnpm -F @shamt/server test
```

Start the server runtime directly when you need to bypass Shopify CLI:

```bash
pnpm -F @shamt/server node:dev
pnpm -F @shamt/server cf:dev
```

Normal Shopify development should still use `pnpm dev` or `pnpm dev:tunnel`
from the repository root so generated Shopify and Wrangler config stay current.

### Type checking

```bash
pnpm -F @shamt/server cf:type
```

Clean workspace outputs:

```bash
pnpm clean
```

## Troubleshooting

### `pnpm dev:tunnel` fails because port `10002` is not available

When `SHOPIFY_APP_FRONTEND_TARGET=frontend`, `dev:prepare` generates a
frontend Shopify web role at `apps/web/shopify.web.toml` with the hard-coded
port from `APP__WEB_PORT`. If another process is already listening on that
port, Shopify CLI stops before starting the app:

```text
Hard-coded port 10002 is not available, please choose a different one.
```

Check what is using the port:

```bash
lsof -nP -iTCP:10002 -sTCP:LISTEN
```

Then either stop that process or choose a different frontend port in
`.env.development`:

```dotenv
APP__WEB_PORT=10003
```

Run the tunnel flow again after changing the env file:

```bash
pnpm dev:tunnel
```

If the tunnel script then reports `wrangler tunnel exited with signal SIGTERM`,
that is usually cleanup after Shopify CLI exits; the unavailable web role port
is the failure to fix first.

### `db:push:d1` fails with `[ELIFECYCLE] Command failed with exit code 1`

`pnpm --dir apps/server run db:push:d1` uses Drizzle Kit's D1 HTTP driver and
must reach the Cloudflare API with a valid account, database id, and token. The
generic lifecycle error often hides the underlying Cloudflare or network
failure.

First confirm the D1 database id in `.env.development` matches the database
name:

```bash
pnpm --dir apps/server exec wrangler d1 list
```

The `uuid` for `APP_DATABASE_D1_NAME` must match `APP_DATABASE_D1_ID`.

Then run the push again:

```bash
pnpm --dir apps/server run db:push:d1
```

If Drizzle Kit still only prints `Pulling schema from database...` and exits,
test direct Cloudflare connectivity from the same shell:

```bash
curl -I https://api.cloudflare.com/client/v4
```

Common causes are:

| Symptom                                          | Cause                                                    | Fix                                                         |
| ------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------- |
| `database ... could not be found` or code `7404` | `APP_DATABASE_D1_ID` points at an old or wrong database. | Copy the current D1 `uuid` into `APP_DATABASE_D1_ID`.       |
| `getaddrinfo ENOTFOUND api.cloudflare.com`       | The shell cannot resolve or reach Cloudflare API.        | Fix DNS/network access, then rerun `db:push:d1`.            |
| Authorization or permission errors               | `APP_CLOUDFLARE_USER_TOKEN` cannot access that D1 DB.    | Use a token with D1 read/write access for the same account. |

### Cloudflare D1 reports `no such table: shopify_sessions`

Development is configured to use the remote development D1 database; see
[`apps/server/docs/guides/d1-development.md`](./apps/server/docs/guides/d1-development.md)
for the decision and local D1 debugging path.

If a development request fails with:

```text
D1_ERROR: no such table: shopify_sessions: SQLITE_ERROR
```

sync the remote development D1 schema first:

```bash
pnpm --dir apps/server run db:push:d1
```

If you intentionally remove `remote: true` for isolated local D1 debugging,
then apply migrations to the local development binding instead:

```bash
pnpm dev:prepare
pnpm --dir apps/server exec wrangler d1 migrations apply i7eo_shopify_app_dev_d1 --env development --local
```

Then restart `pnpm dev:tunnel` and retry the request. Use
`apps/server/wrangler.json` or `APP_DATABASE_D1_BINDING` in `.env.development`
if the development binding name changes.

### Product export download redirects to R2 `NoSuchKey`

If `/api/product-exports/{id}/download` returns successfully but the redirected
R2 signed URL shows:

```text
NoSuchKey The specified key does not exist.
```

the database record likely points at the remote R2 key while the object was
written to Wrangler's local R2 simulation. Development config should keep D1
and R2 on the same remote storage plane:

```bash
pnpm dev:prepare
```

Then confirm `apps/server/wrangler.json` includes `remote: true` on both
`env.development.r2_buckets[]` and `env.development.d1_databases[]`.

Restart `pnpm dev:tunnel` after regenerating config. Exports created before the
R2 binding was remote will still be missing from the remote bucket, so recreate
that export or copy the object into the remote development R2 bucket.

## Deployment

Prepare production config from `.env.production`. This regenerates Shopify TOML
files and `apps/server/wrangler.json` for the active production runtime.

```bash
pnpm deploy:prepare
```

Deploy the selected production runtime and then sync Shopify app
configuration:

```bash
pnpm deploy
```

`deploy` runs `deploy:prepare`, then `deploy:runtime`, then `app:deploy`.
`deploy:runtime` reads `.env.production` through
[`scripts/deploy/index.ts`](./scripts/deploy/index.ts) and only dispatches to
the server-owned runtime deploy script for the active `APP_RUNTIME`:

| Runtime      | Runtime deploy behavior                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `cloudflare` | Runs server `cf:deploy`: builds `apps/web`, writes Worker assets config, then runs Wrangler.           |
| `node`       | Runs server `node:deploy`: builds web/server assets, writes Compose/Nginx config, then deploys Docker. |

For Cloudflare, the server deploy command bulk-loads production secrets with
Wrangler before deploying. The env file supplies secret values; Wrangler's
environment selection must still be explicit when multiple Wrangler envs are
present.

```bash
wrangler secret bulk ../../.env.production --env production
wrangler deploy --env production
```

For Node, deployment files are generated under `apps/server`:

```text
apps/server/docker-compose.yml
apps/server/nginx.conf
```

These generated files are ignored by git. The generated Compose service uses a
Docker image/container name derived from the root package name, and the
container runs the Node build through PM2 runtime. The generated Nginx config
is copied to `/etc/nginx/conf.d/<host>.conf`, and the web build is synced to
`/var/www/<root-package-name>-server/web`.

## Configuration Files

| File                                                             | Purpose                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)                   | Workspace globs, catalogs, Node version, and pnpm policy.                   |
| [`shopify.app.toml`](./shopify.app.toml)                         | Shopify app client id, app URL, scopes, and redirects.                      |
| [`apps/server/shopify.web.toml`](./apps/server/shopify.web.toml) | Shopify CLI web target for the server app.                                  |
| [`apps/web/shopify.web.toml`](./apps/web/shopify.web.toml)       | Shopify CLI web target for the Vite frontend when generated.                |
| [`apps/server/wrangler.json`](./apps/server/wrangler.json)       | Generated Cloudflare Worker entry, environment name, and required bindings. |
| [`apps/server/Dockerfile`](./apps/server/Dockerfile)             | Node runtime container image with PM2 runtime.                              |
| [`scripts/deploy`](./scripts/deploy)                             | Root runtime deploy dispatcher.                                             |
| [`apps/server/scripts/deploy`](./apps/server/scripts/deploy)     | Server-owned Cloudflare and Node deploy implementations.                    |
| [`scripts/write-shopify-file`](./scripts/write-shopify-file)     | Env-driven writer for Shopify app and web TOML files.                       |
| [`scripts/write-wrangler-file`](./scripts/write-wrangler-file)   | Env-driven writer for Cloudflare Wrangler config.                           |

### Custom domains

To use a custom domain instead of `*.workers.dev`, add a Custom Domain in the Cloudflare dashboard under **Workers & Pages > your worker > Settings > Domains & Routes**, then update `SHOPIFY_APP_URL` and the Shopify app URLs accordingly.

## Environment Variables

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `SHOPIFY_APP_KEY`     | App client ID from the Shopify Partner Dashboard |
| `SHOPIFY_APP_SECRET`  | App client secret                                |
| `SHOPIFY_APP_URL`     | Public app URL with no trailing slash            |
| `SCOPES`              | Comma-separated Shopify access scopes            |
| `SHOPIFY_API_VERSION` | Shopify API version from the active env file     |
