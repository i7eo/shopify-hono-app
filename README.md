# Shopify Hono App

A Shopify embedded app backend built with [Hono](https://hono.dev) and deployed to [Cloudflare Workers](https://developers.cloudflare.com/workers/). It implements the full Shopify OAuth flow, session token authentication, token exchange, webhook handling, and a minimal GraphQL API layer — all without external Shopify libraries.

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
npm install
```

### 2. Create and link a Shopify app

Run the following command from the project root:

```bash
shopify app config link
```

This will prompt you to either **create a new app** or **connect to an existing app** in your Partner Dashboard. It updates `shopify.app.toml` with the correct `client_id` and app settings.

After linking, find your **Client Secret** in the [Shopify Dev Dashboard](https://dev.shopify.com/) under your app's **Client credentials** section — you'll need it for the next steps.

### 3. Create a KV namespace

```bash
npx wrangler kv namespace create sofary
```

Copy the output `id` and update [wrangler.toml](wrangler.toml):

```toml
[[kv_namespaces]]
binding = "sofary"
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
shopify app dev --use-localhost
```

This serves the app at `https://localhost:3458` with a self-signed certificate. The URL is stable across sessions. Note: webhooks and app proxies won't work in this mode since Shopify can't reach localhost.

### Alternative: Wrangler only (no Shopify CLI)

If you prefer to manage tunnels yourself:

```bash
npm run dev
```

This runs `wrangler dev` on `http://localhost:8787`. You'll need to:
- Set up your own tunnel (e.g. `cloudflared tunnel`, ngrok)
- Manually update `SHOPIFY_APP_URL` in `.dev.vars` with the tunnel URL
- Manually update `application_url` and `redirect_urls` in `shopify.app.toml`

### Type checking

```bash
npm run typecheck
```

### Regenerate Cloudflare types

```bash
npm run cf-typegen
```

## Production Deployment

### 1. Create the KV namespace (if not done)

```bash
npx wrangler kv namespace create sofary
```

Update the `id` in [wrangler.toml](wrangler.toml) with the production namespace ID.

### 2. Set production secrets

```bash
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
npx wrangler secret put SHOPIFY_APP_URL
npx wrangler secret put SCOPES
```

Each command will prompt you to enter the secret value. `SHOPIFY_APP_URL` should be your production Worker URL (e.g., `https://shopify-hono-app.your-subdomain.workers.dev`) or a custom domain.

### 3. Deploy

```bash
npm run deploy
```

This runs `wrangler deploy`, which builds and publishes the Worker to Cloudflare.

### 4. Update Shopify app settings

In your Shopify Partner Dashboard (or in `shopify.app.toml`), set:

- **App URL** to `https://your-worker.your-subdomain.workers.dev/app`
- **Allowed redirection URL(s)** to `https://your-worker.your-subdomain.workers.dev/auth/callback`

Then push the config:

```bash
shopify app deploy
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
| `sofary` | Stores offline tokens, online tokens, and OAuth state nonces |
