# Project Instructions

## Stack

- Runtime: Cloudflare Workers and Node process runtime, selected by env.
- Framework: Hono with TypeScript.
- Platform: Shopify embedded or standalone app.
- Package manager: pnpm workspace.
- Session storage: D1 or Hyperdrive/PostgreSQL through app-owned runtime adapters.

## Repository Layout

- `apps/server`: Hono server, Shopify auth, webhooks, Admin API routes, runtime adapters, and infrastructure capabilities.
- `apps/web`: Vite/React frontend target for Shopify app UI.
- `apps/document`: VitePress documentation app.
- `packages/*`: Reusable workspace libraries. Keep them runtime-aware only when their package purpose explicitly requires it.
- `scripts/*`: Root tooling for generated Shopify, Wrangler, tunnel, and deployment files.
- `docs/*`: Repository-level guides, reference material, notes, and cross-package documentation.

## Codex Surface Rules

- Put durable project rules in `AGENTS.md` files. Put one-off constraints in the prompt.
- Put reusable workflows in `.agents/skills/*/SKILL.md`.
- Put project-scoped Codex settings in `.codex/config.toml`; do not put engineering rules there.
- Add closer `AGENTS.md` files when a package or app needs stricter local rules. Closer files override or refine this root file.

## Monorepo Coding Rules

- Prefer existing workspace packages, helpers, types, and patterns before introducing new logic.
- Avoid duplicating behavior that already exists in `packages/*`; extract shared logic when duplication appears more than once.
- Follow the referenced folder's architecture, naming, file layout, validation style, error handling style, export shape, tests, and documentation style when the user asks to reference or borrow from a folder.
- Prefer established local patterns and high-performance implementations.
- Large rewrites are acceptable when they meaningfully improve correctness, performance, maintainability, or pattern consistency.
- Before large rewrites, inspect call sites, public API boundaries, tests, and runtime constraints. Preserve behavior unless a breaking change is explicitly intended.
- Keep code dependency direction clear: low-level shared packages must not import apps or runtime-specific infrastructure.
- Use structured parsers and typed APIs instead of ad hoc string manipulation when practical.

## Workspace Semantic Ownership

- Treat workspace package names as semantic ownership boundaries.
- When app code uses env concepts, first check `@shamt/app-env` for schemas, types, enums, defaults, constants, parsing helpers, and runtime/provider contracts.
- When app code uses database-backed data shapes, first check `@shamt/database` for table schemas, Drizzle-Zod schemas, status values, insert/select types, and inferred types.
- When a `packages/*` export already represents a concept, derive, adapt, or compose from that export instead of duplicating schema, enum, type, constant, utility, or behavior logic in `apps/*`.
- App-local schema, type, enum, or utility logic is acceptable only when the owning package does not provide the concept, or when the app boundary deliberately needs a serialized, browser-safe, public, runtime capability, or transport-specific adaptation.
- Package code should provide stable exports for the schemas, types, enums, constants, defaults, parsing helpers, and utilities that belong to that package's domain.
- Packages must not duplicate logic from sibling packages. Import the owning package when dependency direction allows it, or extract the shared concept to the correct lower-level package.
- Reusable packages must not import `apps/*` or runtime-specific app infrastructure.
- When adding a package-owned concept, update package entrypoints, README, examples, and nearby guidance when needed.
- After app or package changes, check nearby imports and new local definitions for package-owned concepts that should be reused from `packages/*`.

## Type And Utility Organization

- Put reusable public types, interfaces, declarations, and shared type aliases in `types.ts`.
- Put reusable package-local implementation helpers in `utils.ts` when they are used by multiple files or represent stable shared behavior.
- Keep one-off feature-local helpers close to their caller.
- Keep constants in `constants.ts` or `constants/` when they are part of a package API or repeated local pattern.
- Export through package or folder `index.ts` files according to the existing package style.

## Documentation Comments

- Add JSDoc/TSDoc for exported functions, classes, types, clients, adapters, and public package APIs.
- Add comments for important or complex internal logic only when the reason is not obvious from the code.
- Avoid comments that merely restate the implementation.
- For `packages/*`, public APIs should include `@example` when usage is not trivial.
- For complex library behavior, include a realistic TypeScript example in either JSDoc `@example` or the package README.

## README And Docs

- Keep root README navigational and architectural.
- `packages/*` READMEs must follow library documentation style: purpose, installation/import, public API, usage examples, gotchas, and runtime notes.
- `apps/*` READMEs must follow application usage style: purpose, local development, env, commands, runtime behavior, deployment, and troubleshooting.
- Before a user-requested push or release-prep workflow, update or generate English and Chinese README files when package behavior changed.
- Use `README.md` for English and `README.zh-CN.md` for Chinese when both are present.
- Store repository-level decisions and task-oriented documentation in `docs/guides/`; store package or app-specific guide material under that workspace's `docs/guides/`.
- Store descriptions, explanations, and usage manuals in `docs/reference/` or the closest workspace `docs/reference/`.
- Store ongoing notes or backlog items in `docs/notes/` or the closest workspace `docs/notes/`.

## Generated Files And Secrets

- Do not commit secrets or print secret values in final answers.
- Treat `.env.*`, `.dev.vars`, Shopify secrets, Cloudflare tokens, Redis credentials, database URLs, and private keys as sensitive.
- Do not hand-edit generated Shopify or Wrangler files unless the user explicitly asks for generated-output debugging.
- Root prepare scripts own generated Shopify and Wrangler config.
- D1 local data lives under `.wrangler/`; do not delete it unless explicitly asked.

## Development Commands

- Install: `pnpm install`
- Prepare local generated config: `pnpm dev:prepare`
- Local Shopify development: `pnpm dev`
- Fixed tunnel development: `pnpm dev:tunnel`
- Prepare deploy config: `pnpm deploy:prepare`
- Deploy: `pnpm deploy`
- Workspace lint: `pnpm lint`
- Workspace format: `pnpm format`

Prefer package-scoped commands for focused work, for example:

```bash
pnpm -F @shamt/server test
pnpm -F @shamt/server lint
pnpm -F @shamt/web build
pnpm -F @shamt/cache test
```

## Verification

- Run the narrowest relevant lint, test, type, or build command before claiming work is complete.
- For package code changes, run that package's test or build script when present.
- For `apps/server`, prefer focused Vitest coverage for runtime, infra, middleware, and Shopify behavior.
- For `apps/web`, verify build or test when changing routing, env injection, API clients, or UI behavior.
- For documentation-only changes, inspect the rendered Markdown structure mentally or with file reads; tests are not required unless docs generation scripts changed.

## User Workflow Preferences

- The user may add mid-task notes. Treat messages prefixed with "旁注", "补充约束", "记忆点", or "后续 TODO" as additive context unless they explicitly say to pause.
- If the user says "暂停", stop implementation and reassess.
- If the user asks to "reference" or "borrow from" a folder, follow that folder's pattern closely and point out better best-practice alternatives before deviating.
- Before push-oriented workflows, update docs, check comments/examples for public APIs, run relevant verification, and summarize what changed.
