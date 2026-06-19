# Oh My Fetch Package Instructions

## Scope

`@shamt/oh-my-fetch` owns the workspace HTTP client built on `ky`, including core request handling, lifecycle management, secure JSON parsing, error normalization, schema validation, and explicit plugins.

## Architecture Rules

- Keep the core small, safe, and runtime-neutral.
- Keep application UI, business response wrappers, logging providers, and framework-specific exceptions out of core.
- Put optional policies in explicit plugins under `src/plugins/`.
- Preserve explicit subpath entrypoints for plugins, validation, errors, status helpers, JSON security, dedupe, and utils.
- Do not make business wrapper checks, request formatting, schema validation, dedupe, or error reporting implicit defaults unless explicitly requested.

## Security And Error Rules

- Preserve strict JSON security by default.
- Keep prototype-pollution sanitization behavior explicit and tested.
- Normalize failures into `HttpRequestError`.
- Keep request config redaction conservative. Sensitive headers, query values, tokens, cookies, passwords, and API keys must not appear in serialized errors.
- Do not store raw request bodies in error config.

## File Organization

- Keep client orchestration under `src/client/`.
- Keep request body/query/header/response mechanics under `src/core/`.
- Keep abort, dedupe, and disposable scope behavior under `src/lifecycle/`.
- Keep security helpers under `src/security/`.
- Keep validation adapters under `src/validation/`.
- Put shared public types in `types.ts` files near their subsystem.
- Put stable subsystem constants in `constants.ts`.

## Documentation

- README must describe this as a library package: design, defaults, entrypoints, usage, plugins, validation, dedupe, JSON security, errors, and runtime notes.
- Include examples for new public client options, plugins, or subpath exports.

## Verification

- Run `pnpm -F @shamt/oh-my-fetch test` for behavior changes.
- Run `pnpm -F @shamt/oh-my-fetch build` for export or build changes.
- Run `pnpm -F @shamt/oh-my-fetch lint` after broad TypeScript or Markdown edits.
