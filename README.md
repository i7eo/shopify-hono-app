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

| Package                                               | Version | Description                                                                |
| ----------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| [`@shamt/utils`](./packages/utils#readme)             | `0.0.0` | Shared utility functions for JSON, dates, guards, cookies, trees, and ids. |
| [`@shamt/envs`](./packages/envs#readme)               | `0.0.0` | Base constants and Zod schemas for runtime-neutral environment config.     |
| [`@shamt/app-env`](./packages/app-env#readme)         | `0.0.0` | App-specific env schema that composes `@shamt/envs` with Shopify fields.   |
| [`@shamt/cache`](./packages/cache#readme)             | `0.0.0` | Runtime-neutral cache contract with an LRU memory implementation.          |
| [`@shamt/oh-my-fetch`](./packages/oh-my-fetch#readme) | `0.0.0` | Workspace HTTP client built on `ky` with explicit subpath entrypoints.     |

## Architecture

The dependency direction is intentionally one-way:

```text
@shamt/utils
  -> @shamt/envs
  -> @shamt/app-env / @shamt/cache / @shamt/oh-my-fetch
  -> apps/server / apps/web
  -> Shopify Admin API / Shopify App Bridge / Cloudflare Workers
```

`@shamt/utils` is the lowest-level shared layer. It exposes small helpers and
selected external utilities without depending on the rest of the workspace.

`@shamt/envs` centralizes base constants and Zod schemas, but it does not read
from `process.env` or Cloudflare bindings directly. `@shamt/app-env` composes
those base schemas with Shopify app fields such as `SHOPIFY_APP_MODE` and
`SHOPIFY_APP_FRONTEND_TARGET`.

`@shamt/cache` defines the shared cache contract and default memory driver.
Runtime-specific stores, such as Cloudflare KV backed Shopify session storage,
stay in the app layer.

`@shamt/oh-my-fetch` wraps `ky` for consistent HTTP behavior across services:
query serialization, body handling, timeout, retry, response parsing, schema
validation, normalized request errors, and optional plugins imported from
explicit subpath entrypoints.

`apps/server` composes the shared packages with Hono, Shopify API libraries,
Cloudflare Workers bindings, LogTape logging, and Shopify app routes. It has two
runtime entries:

| Runtime            | Entry                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers | [`apps/server/src/app/runtime/isolate/cloudflare/index.ts`](./apps/server/src/app/runtime/isolate/cloudflare/index.ts) |
| Node process       | [`apps/server/src/app/runtime/process/index.ts`](./apps/server/src/app/runtime/process/index.ts)                       |

## App Runtime

The server app provides:

- Shopify OAuth and callback handling.
- Shopify app shell rendering or redirect fallback.
- Embedded session-token verification and token exchange middleware.
- Standalone account-session cookie handling.
- Admin GraphQL-backed shop and product API routes.
- Shopify webhook endpoints.
- Cloudflare KV session storage integration.
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
SHOPIFY_APP_URL=https://sofary-app-dev-server.i7eo.com
SHOPIFY_API_VERSION=2026-04
SCOPES=read_products,write_products,read_orders
```

The root preparation script writes Shopify config values from the selected env
file before local dev or deploy:

```bash
pnpm dev:prepare
pnpm deploy:prepare
```

`scripts/write-shopify-file` regenerates `shopify.app.toml` plus the Shopify
web role files on every prepare run. It deletes existing `shopify.web.toml`
files first, then writes `apps/server/shopify.web.toml` and, when
`SHOPIFY_APP_FRONTEND_TARGET=frontend`, `apps/web/shopify.web.toml`.

### Switching Server Runtime

`apps/server` can run locally as a Node process or through Wrangler's
Cloudflare Workers dev runtime. Keep the Shopify web target command and
`APP_RUNTIME` aligned.

Use the Node process runtime when you want fast local debugging with
`@hono/node-server`:

```toml
# apps/server/shopify.web.toml
[commands]
dev = "pnpm node:dev"
```

```dotenv
# .env.development
APP_RUNTIME=node
```

Use the Cloudflare Workers runtime when you want local dev to exercise the
Worker entry and Cloudflare bindings:

```toml
# apps/server/shopify.web.toml
[commands]
dev = "pnpm cf:dev"
```

```dotenv
# .env.development
APP_RUNTIME=cloudflare
```

After changing either file, restart `pnpm dev`. The `APP_RUNTIME` value is
validated during bootstrap, so a mismatch fails early instead of silently
running the wrong adapter.

### Development Tunnel

The default local development flow uses Shopify CLI's autogenerated quick
tunnel:

```bash
pnpm dev
```

Use the named Cloudflare Tunnel `sofary` only when you need the fixed public
hostname:

```text
https://sofary-app-dev-server.i7eo.com
```

For the named tunnel flow, Cloudflare Zero Trust must point the Public Hostname
for `sofary-app-dev-server.i7eo.com` to the Shopify CLI local proxy:

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

If Cloudflare returns `1033`, the tunnel connector is not active. Check:

```bash
pnpm exec wrangler tunnel info sofary
```

If Cloudflare returns `502`, the tunnel is active but cannot reach the local
Shopify CLI proxy. Verify that `10101` is listening locally.

### Common Commands

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

| Script            | Purpose                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `postinstall`     | Installs simple-git-hooks after dependencies are installed.                |
| `dev:prepare`     | Loads `.env.development` and regenerates Shopify app/web TOML files.       |
| `app:dev`         | Runs `shopify app dev` with Shopify CLI's autogenerated quick tunnel.      |
| `dev`             | Runs `dev:prepare` and then `app:dev`.                                     |
| `dev:tunnel`      | Runs `dev:prepare`, starts the `sofary` tunnel, then runs Shopify app dev. |
| `deploy:prepare`  | Loads `.env.production` and regenerates production Shopify TOML files.     |
| `deploy:runtime`  | Dispatches to the server deploy script for the active `APP_RUNTIME`.       |
| `app:deploy`      | Runs `shopify app deploy --config production`.                             |
| `deploy`          | Runs prepare, runtime deploy, and Shopify app deploy in order.             |
| `format`          | Runs each workspace package format script.                                 |
| `lint`            | Runs each workspace package lint script.                                   |
| `clean`           | Runs root cleanup tasks.                                                   |
| `clean:workspace` | Runs each workspace package clean script.                                  |
| `clean:cache`     | Removes root dependency/cache files.                                       |
| `commit`          | Starts the Commitizen prompt.                                              |
| `upgrade:pkgs`    | Opens recursive interactive package upgrades.                              |

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

Build a shared package:

```bash
pnpm -F @shamt/utils build
```

Generate Cloudflare Worker types for the server app:

```bash
pnpm -F @shamt/server cf:type
```

Clean workspace outputs:

```bash
pnpm clean
```

## Deployment

Prepare production config from `.env.production`:

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
Wrangler before deploying:

```bash
wrangler secret bulk ../../.env.production
wrangler deploy
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

| File                                                             | Purpose                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)                   | Workspace globs, catalogs, Node version, and pnpm policy.    |
| [`shopify.app.toml`](./shopify.app.toml)                         | Shopify app client id, app URL, scopes, and redirects.       |
| [`apps/server/shopify.web.toml`](./apps/server/shopify.web.toml) | Shopify CLI web target for the server app.                   |
| [`apps/web/shopify.web.toml`](./apps/web/shopify.web.toml)       | Shopify CLI web target for the Vite frontend when generated. |
| [`apps/server/wrangler.json`](./apps/server/wrangler.json)       | Cloudflare Worker entry, compatibility date, and KV binding. |
| [`apps/server/Dockerfile`](./apps/server/Dockerfile)             | Node runtime container image with PM2 runtime.               |
| [`scripts/deploy`](./scripts/deploy)                             | Root runtime deploy dispatcher.                              |
| [`apps/server/scripts/deploy`](./apps/server/scripts/deploy)     | Server-owned Cloudflare and Node deploy implementations.     |
| [`scripts/write-shopify-file`](./scripts/write-shopify-file)     | Env-driven writer for Shopify app and web TOML files.        |

## Runtime Data

Cloudflare KV stores Shopify session data through the server app's Shopify
session storage integration.

| Binding  | Purpose                                                      |
| -------- | ------------------------------------------------------------ |
| `sofary` | Stores offline tokens, online tokens, and OAuth state nonces |

Local Wrangler data is stored under `.wrangler/` during development.

## Notes For Contributors

- Keep shared packages runtime-neutral unless the package is explicitly an
  adapter.
- Keep dependency direction flowing from `packages/` into `apps/`, not the other
  way around.
- Keep Shopify admin UI inside Polaris web components.
- Put package-specific setup and API details in package READMEs.
- Treat root README as the navigation and architecture entry point.
