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

```
src/
├── index.ts                         # Hono app entry point & route mounting
├── types.ts                         # TypeScript types (bindings, JWT claims, API responses)
├── routes/
│   ├── auth.ts                      # OAuth install + callback (/auth, /auth/callback)
│   ├── app.ts                       # Embedded app HTML shell (/app)
│   ├── api.ts                       # Authenticated API endpoints (/api/shop, /api/products)
│   └── webhooks.ts                  # Webhook receivers (/webhooks/*)
├── middleware/
│   ├── ensure-installed.ts          # Checks for offline token, redirects to OAuth if missing
│   ├── verify-session-token.ts      # Validates App Bridge session token (JWT)
│   ├── token-exchange.ts            # Exchanges session token for online access token
│   └── verify-webhook.ts            # HMAC-SHA256 webhook signature verification
└── lib/
    ├── crypto.ts                    # Web Crypto helpers (HMAC, JWT, timing-safe compare)
    ├── session-store.ts             # KV-backed session & OAuth state storage
    └── shopify-client.ts            # Minimal Shopify Admin GraphQL API client
```

### Request flow

1. **Installation** — Merchant visits `/auth?shop=...`, gets redirected to Shopify's OAuth consent screen, then back to `/auth/callback` where the offline access token is stored in KV.
2. **Embedded app** — Shopify Admin loads `/app?shop=...` in an iframe. The `ensureInstalled` middleware verifies the shop has an offline token; if not, it redirects to OAuth. The response is a minimal HTML shell that loads App Bridge.
3. **API calls** — App Bridge intercepts `fetch()` calls from the frontend and attaches a session token JWT. The `/api/*` routes validate this JWT (`verifySessionToken`), exchange it for a short-lived online access token (`tokenExchange`), and then call the Shopify Admin GraphQL API.
4. **Webhooks** — Shopify sends POST requests to `/webhooks/*` with an HMAC signature header. The `verifyWebhook` middleware validates the signature before passing the payload to route handlers.

### Key design decisions

- **Zero Shopify library dependencies** — OAuth, HMAC verification, JWT validation, and token exchange are all implemented with the Web Crypto API, keeping the bundle small and Worker-compatible.
- **KV for sessions** — Cloudflare KV stores offline tokens (permanent), online tokens (with TTL), and OAuth state nonces (10-minute TTL).
- **Token exchange over cookie sessions** — Uses Shopify's token exchange grant type instead of traditional cookie-based sessions, which is the recommended approach for embedded apps.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth` | None | Starts OAuth install flow |
| `GET` | `/auth/callback` | HMAC-verified | Completes OAuth, stores offline token |
| `GET` | `/app` | `ensureInstalled` | Serves embedded app HTML shell |
| `GET` | `/api/shop` | Session token + token exchange | Returns shop name, email, domain |
| `GET` | `/api/products` | Session token + token exchange | Lists first 5 products |
| `POST` | `/webhooks/app/uninstalled` | Webhook HMAC | Cleans up session on uninstall |
| `POST` | `/webhooks/customers/data-request` | Webhook HMAC | GDPR customer data request |
| `POST` | `/webhooks/customers/redact` | Webhook HMAC | GDPR customer data deletion |
| `POST` | `/webhooks/shop/redact` | Webhook HMAC | GDPR shop data deletion |
| `GET` | `/health` | None | Health check |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (v4+) — installed as a dev dependency
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) (v3+)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A [Shopify Partner account](https://partners.shopify.com/) and a development store

## Setup

### 1. Install dependencies

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
shopify app config link
```

This will prompt you to either **create a new app** or **connect to an existing app** in your Partner Dashboard. It updates `shopify.app.toml` with the correct `client_id` and app settings.

After linking, find your **Client Secret** in the [Shopify Dev Dashboard](https://dev.shopify.com/) under your app's **Client credentials** section — you'll need it for the next steps.

### 3. Create a KV namespace

```bash
npx wrangler kv namespace create SESSION_KV
```

Copy the output `id` and update [wrangler.toml](wrangler.toml):

```toml
[[kv_namespaces]]
binding = "SESSION_KV"
id = "your-actual-kv-namespace-id"
```

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```
SHOPIFY_API_KEY=your_app_client_id
SHOPIFY_API_SECRET=your_app_client_secret
SHOPIFY_APP_URL=https://your-tunnel-url.trycloudflare.com
SCOPES=read_products,write_products,read_orders
```

> **Note:** When using `shopify app dev` (recommended), the `SHOPIFY_APP_URL` in `.dev.vars` gets overridden automatically — Shopify CLI injects the tunnel URL as the `APP_URL` environment variable. You still need the other three values.

### 5. Update shopify.app.toml

Edit [shopify.app.toml](shopify.app.toml) with your app's `client_id`. The `application_url` and `redirect_urls` are updated automatically by Shopify CLI during `shopify app dev`.

## Development

### How Shopify CLI and Wrangler work together

This project uses **two tools** during local development, and understanding their roles is key:

| Tool | Role |
|------|------|
| **Wrangler** | Runs the Cloudflare Worker locally (your actual app code), simulates KV bindings, reads `.dev.vars` for secrets |
| **Shopify CLI** | Creates an HTTPS tunnel, updates your app's URLs in the Partner Dashboard, injects env vars (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `APP_URL`, etc.), opens your dev store |

You do **not** run them separately. Shopify CLI starts Wrangler for you.

### How it works

The [shopify.web.toml](shopify.web.toml) file tells Shopify CLI how to start your app:

```toml
roles = ["backend"]

[commands]
dev = "npx wrangler dev --port $PORT"
build = "npx wrangler deploy"
```

When you run `shopify app dev`, Shopify CLI:

1. Reads `shopify.web.toml` and finds the `dev` command
2. Picks a port and sets `$PORT` (along with `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `APP_URL`, `SCOPES`, etc. as env vars)
3. Executes `npx wrangler dev --port $PORT` — starting your Worker on that port
4. Opens a Cloudflare Quick Tunnel (HTTPS) pointing to that port
5. Updates your app's URLs in the Shopify Partner Dashboard to match the tunnel
6. Opens the app in your development store

### Running locally

```bash
shopify app dev
```

That's it. On first run it will prompt you to:
- Select your Shopify Partner org
- Select or create a development store
- Confirm the app configuration

Once running, you'll see output like:

```
 ›   Press p to open your app's URL in the browser
 ›   Preview URL: https://abc123.trycloudflare.com/app
```

Shopify CLI keeps the tunnel alive and restarts Wrangler if it crashes.

### Environment variables during dev

Shopify CLI automatically injects these env vars into the Wrangler process:

| Variable | Source |
|----------|--------|
| `SHOPIFY_API_KEY` | From your app's Partner Dashboard config |
| `SHOPIFY_API_SECRET` | From your app's Partner Dashboard config |
| `APP_URL` / `HOST` | The tunnel URL (e.g. `https://abc123.trycloudflare.com`) |
| `SCOPES` | From `shopify.app.toml` |
| `BACKEND_PORT` / `PORT` | The port Wrangler should listen on |

However, **Wrangler reads secrets from `.dev.vars`**, not from shell env vars. So you still need your `.dev.vars` file with `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SCOPES`. The `SHOPIFY_APP_URL` in `.dev.vars` should be kept up to date — if the tunnel URL changes each session, you can either:

- Update `.dev.vars` each time with the new tunnel URL, or
- Use `--use-localhost` mode (see below) for a stable URL

### Alternative: Localhost mode (stable URL)

If you don't want the tunnel URL to change each time, use localhost mode (requires Shopify CLI 3.80+):

```bash
pnpm -F @shamt/server test
```

Build a shared package:

```bash
npm run dev
```

This runs `wrangler dev` on `http://localhost:8787`. You'll need to:
- Set up your own tunnel (e.g. `cloudflared tunnel`, ngrok)
- Manually update `SHOPIFY_APP_URL` in `.dev.vars` with the tunnel URL
- Manually update `application_url` and `redirect_urls` in `shopify.app.toml`

### Type checking

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
npx wrangler kv namespace create SESSION_KV
```

Deploy the Shopify app configuration:

```bash
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
npx wrangler secret put SHOPIFY_APP_URL
npx wrangler secret put SCOPES
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

### 5. Configure webhooks

Webhook subscriptions are declared in [shopify.app.toml](shopify.app.toml). Running `shopify app deploy` registers them automatically. The `app/uninstalled` webhook and GDPR compliance webhooks are pre-configured.

### Custom domains

To use a custom domain instead of `*.workers.dev`, add a Custom Domain in the Cloudflare dashboard under **Workers & Pages > your worker > Settings > Domains & Routes**, then update `SHOPIFY_APP_URL` and the Shopify app URLs accordingly.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | App client ID from the Shopify Partner Dashboard |
| `SHOPIFY_API_SECRET` | App client secret |
| `SHOPIFY_APP_URL` | Public URL of this Worker (no trailing slash) |
| `SCOPES` | Comma-separated Shopify access scopes |
| `SHOPIFY_API_VERSION` | Shopify API version (set in `wrangler.toml`, default `2025-10`) |

## KV Bindings

| Binding | Purpose |
|---------|---------|
| `SESSION_KV` | Stores offline tokens, online tokens, and OAuth state nonces |
