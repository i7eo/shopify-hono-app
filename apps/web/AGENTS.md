# Web Workspace Instructions

## Scope

`apps/web` owns the Vite/React frontend target, Shopify App Bridge integration, public env injection, browser API client, TanStack Router and Query setup, and admin UI rendering.

## UI Rules

- Shopify admin UI must use Polaris web components loaded by the app shell.
- Do not introduce custom CSS, raw HTML UI, or non-Polaris component libraries for admin interfaces.
- Use `<s-page>` as the top-level page layout and `<s-section>` for content areas.
- Use `<s-banner>` for messages, `<s-spinner>` for loading, and `<s-text>` for text.
- Escape user-facing strings that are injected into component HTML.
- Use React only to orchestrate state, routing, and component composition around Polaris web components.

## Env And Browser Boundary

- Browser code must not import `configs/env.ts` or parse full server env.
- Public browser env must flow through the existing Vite public env plugin and `src/utils/public-env.ts`.
- Keep secret filtering conservative. New secret, token, database, Redis, password, ID, private, or scope-like env fields must be filtered from browser output.
- Keep App Bridge loading conditional on Shopify app mode and existing shell injection patterns.

## API Client Rules

- Browser API calls should go through `src/utils/client.shopify.ts` and `src/apis/*`.
- Do not duplicate authorization header logic, OAuth recovery, or redirect throttling in pages.
- Page and route components should call business API functions rather than constructing raw fetch requests.
- Reuse `@shamt/oh-my-fetch` and existing client hooks before adding client-specific request logic.

## File Organization

- Keep Vite config and plugins under `configs/` and `scripts/vite/`.
- Keep public constants for build plugins under `constants/`.
- Keep route-level UI in route files and shared UI states in `src/components/`.
- Put reusable browser helpers in `src/utils/`.
- Put reusable types in local `types.ts` files or `typings/` when they describe globals.

## Documentation

- Update `apps/web/README.md` when changing env injection, App Bridge behavior, Vite server/proxy behavior, image optimization, routing, or API client boundaries.
- App README content should focus on usage, env, commands, runtime behavior, and troubleshooting.

## Verification

- For frontend behavior changes, run `pnpm -F @shamt/web test` when tests are relevant.
- Run `pnpm -F @shamt/web build` when changing Vite config, env injection, routing, or production assets.
- Run `pnpm -F @shamt/web lint` after broad TypeScript, React, Markdown, or JSON edits.
