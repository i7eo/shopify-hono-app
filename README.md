# Shopify Hono App

This repository contains a Shopify embedded app built for Cloudflare Workers
with Hono, Shopify CLI, Wrangler, and a small set of shared TypeScript
packages.

It is organized as a pnpm monorepo. The app code lives under `apps/`, reusable
runtime libraries live under `packages/`, and root scripts coordinate Shopify
configuration, Cloudflare Tunnel, local development, formatting, linting, and
deployment.

## Workspace

### Apps

These packages are private application entry points.

| Package                              | Version | Description                                                                             |
| ------------------------------------ | ------- | --------------------------------------------------------------------------------------- |
| [`@shamt/server`](./apps/server)     | `0.0.0` | Hono app for Shopify auth, embedded admin UI, API routes, webhooks, and Worker runtime. |
| [`@shamt/web`](./apps/web#readme)    | `0.0.0` | Optional React and Vite frontend workspace.                                             |
| [`@shamt/document`](./apps/document) | `0.0.0` | VitePress documentation app.                                                            |

### Shared Runtime Packages

These packages provide reusable framework-neutral building blocks for the apps.

| Package                                               | Version | Description                                                                |
| ----------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| [`@shamt/utils`](./packages/utils#readme)             | `0.0.0` | Shared utility functions for JSON, dates, guards, cookies, trees, and ids. |
| [`@shamt/envs`](./packages/envs#readme)               | `0.0.0` | Shared constants and Zod schemas for environment and runtime config.       |
| [`@shamt/cache`](./packages/cache#readme)             | `0.0.0` | Runtime-neutral cache contract with an LRU memory implementation.          |
| [`@shamt/oh-my-fetch`](./packages/oh-my-fetch#readme) | `0.0.0` | Workspace HTTP client built on `ky` with retries, validation, and errors.  |

## Architecture

The dependency direction is intentionally one-way:

```text
@shamt/utils
  -> @shamt/envs
  -> @shamt/cache / @shamt/oh-my-fetch
  -> apps/server
  -> Shopify Admin API / Cloudflare Workers
```

`@shamt/utils` is the lowest-level shared layer. It exposes small helpers and
selected external utilities without depending on the rest of the workspace.

`@shamt/envs` centralizes constants and Zod schemas, but it does not read from
`process.env` or Cloudflare bindings directly. Apps choose the runtime source of
environment values.

`@shamt/cache` defines the shared cache contract and default memory driver.
Runtime-specific stores, such as Cloudflare KV backed Shopify session storage,
stay in the app layer.

`@shamt/oh-my-fetch` wraps `ky` for consistent HTTP behavior across services:
query serialization, body handling, timeout, retry, response parsing, business
status validation, schema validation, and normalized request errors.

`apps/server` composes the shared packages with Hono, Shopify API libraries,
Cloudflare Workers bindings, LogTape logging, and Shopify embedded app routes.
It has two runtime entries:

| Runtime            | Entry                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers | [`apps/server/src/app/runtime/isolate/cloudflare/index.ts`](./apps/server/src/app/runtime/isolate/cloudflare/index.ts) |
| Node process       | [`apps/server/src/app/runtime/process/index.ts`](./apps/server/src/app/runtime/process/index.ts)                       |

## Server App

The server app is the primary product surface. It provides:

- Shopify OAuth and callback handling.
- Shopify embedded app shell.
- Session-token verification and token exchange middleware.
- Admin GraphQL-backed shop and product API routes.
- Shopify webhook endpoints.
- Cloudflare KV session storage integration.
- Health checks and OpenAPI route registration.
- Cloudflare Worker and Node process runtime adapters.

The Shopify admin UI served by the app shell uses Shopify Polaris web
components. The app shell loads:

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
- A Cloudflare account with the `sofary` named tunnel configured.

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

`apps/web/shopify.web.toml` is optional. If it does not exist, the prepare
script skips that web target and continues with the server and app config.

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

The final local tunnel setup uses the named Cloudflare Tunnel `sofary` and the
public hostname:

```text
https://sofary-app-dev-server.i7eo.com
```

In Cloudflare Zero Trust, the Public Hostname for
`sofary-app-dev-server.i7eo.com` must point to the Shopify CLI local proxy:

```text
http://[::1]:10101
```

The local port split is:

| Port    | Owner              | Purpose                               |
| ------- | ------------------ | ------------------------------------- |
| `10101` | Shopify CLI        | Local proxy for the custom tunnel URL |
| `10001` | Wrangler / workerd | Cloudflare Worker development server  |

Start the tunnel and the app in separate terminals:

```bash
pnpm dev:tunnel
```

```bash
pnpm dev
```

The relevant root scripts are:

```json
{
  "dev:tunnel": "TUNNEL_TRANSPORT_PROTOCOL=http2 wrangler tunnel run sofary",
  "app:dev": "pnpm dev:prepare && shopify app dev --tunnel-url=https://sofary-app-dev-server.i7eo.com:10101"
}
```

Do not configure the tunnel service as `https://127.0.0.1:10101`; the Shopify
CLI proxy is plain HTTP.

If Cloudflare returns `1033`, the tunnel connector is not active. Check:

```bash
pnpm exec wrangler tunnel info sofary
```

If Cloudflare returns `502`, the tunnel is active but cannot reach the local
Shopify CLI proxy. Verify that `10101` is listening locally.

### Common Commands

Run the embedded app locally:

```bash
pnpm dev
```

Run the Cloudflare Tunnel:

```bash
pnpm dev:tunnel
```

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

Deploy the Shopify app configuration:

```bash
pnpm app:deploy
```

Deploy the Worker from the server workspace:

```bash
pnpm -F @shamt/server cf:deploy
```

The server deploy command bulk-loads production secrets with Wrangler before
deploying:

```bash
wrangler secret bulk ../../.env.production
wrangler deploy
```

## Configuration Files

| File                                                             | Purpose                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| [`pnpm-workspace.yaml`](./pnpm-workspace.yaml)                   | Workspace globs, catalogs, Node version, and pnpm policy.    |
| [`shopify.app.toml`](./shopify.app.toml)                         | Shopify app client id, app URL, scopes, and redirects.       |
| [`apps/server/shopify.web.toml`](./apps/server/shopify.web.toml) | Shopify CLI web target for the server app.                   |
| [`apps/server/wrangler.json`](./apps/server/wrangler.json)       | Cloudflare Worker entry, compatibility date, and KV binding. |
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
