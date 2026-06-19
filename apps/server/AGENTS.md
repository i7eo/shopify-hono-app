# Server Workspace Instructions

## Scope

`apps/server` owns the Hono application, Shopify auth and webhooks, Admin API resource modules, app shell fallback, runtime adapters, OpenAPI registration, and infrastructure capabilities for database, bucket, queue, scheduler, logger, env, and file handling.

## Architecture Rules

- Preserve the runtime split between Node process and Cloudflare isolate.
- Keep runtime capability registration explicit. Do not make shared modules read process globals or Worker bindings directly.
- Keep infrastructure under `src/infra/*`, app modules under `src/app/modules/*`, runtime entries under `src/app/runtime/*`, shared middleware/models/errors under `src/shared/*`, and generic helpers under `src/utils/*`.
- Resource APIs should live as independent modules under `src/app/modules/*`; do not put new business resource routes inside the Shopify app-flow module unless they are truly part of auth/app flow.
- Normalize errors through the shared `AppError` pattern and existing Hono `onError` behavior.
- Preserve fail-fast startup behavior for duplicate registry entries and invalid runtime invariants.

## Shopify Rules

- Use the existing Shopify middleware and session-token/token-exchange flow for embedded Admin API routes.
- Keep embedded and standalone app modes explicit. Embedded mode uses App Bridge session tokens; standalone mode uses account-session cookies.
- Verify Shopify webhook HMAC behavior when changing webhook handlers.
- Use official Shopify Admin GraphQL patterns and the current app API version from env.
- Escape user-facing HTML injected into app shell responses.

## Runtime And Infrastructure Rules

- Database and bucket providers must remain selected by env and runtime capability boundaries.
- Node PostgreSQL, Node D1 HTTP, Cloudflare D1 binding, and Hyperdrive/PostgreSQL behavior must stay separated behind the app database factory.
- Process runtime may cache long-lived clients and must dispose them on shutdown or test teardown.
- Cloudflare isolate runtime must treat request/event bindings as the resource boundary.
- Queue and scheduler changes must preserve both Node provider behavior and Cloudflare Queues/Cron Trigger behavior where applicable.

## File Organization

- Put shared exported types in `types.ts` close to their module or package boundary.
- Put stable module-local helpers in `utils.ts` when reused by multiple files.
- Keep route schemas, response models, and OpenAPI registration near the module that owns them.
- Add examples in README or docs when adding a new module, capability, or public route pattern.

## Documentation

- Update `apps/server/README.md` or `apps/server/docs/*` when runtime, env, deployment, Shopify, queue, scheduler, database, bucket, file, or error behavior changes.
- Put server-specific decisions and task-oriented guides under `apps/server/docs/guides/`.
- Put descriptive reference material, explanations, and usage manuals under `apps/server/docs/reference/`.
- Put server-specific notes or backlog under `apps/server/docs/notes/`.
- Keep docs factual and current; remove obsolete design drafts instead of preserving stale alternatives.

## Verification

- For server code changes, prefer `pnpm -F @shamt/server test`.
- Run `pnpm -F @shamt/server lint` after broad TypeScript or Markdown edits.
- Run `pnpm -F @shamt/server build` when runtime entrypoints, bundling, or Cloudflare/Node build behavior changes.
- Run `pnpm -F @shamt/server cf:type` when Worker bindings change.
