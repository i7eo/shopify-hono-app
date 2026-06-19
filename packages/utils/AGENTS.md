# Utils Package Instructions

## Scope

`@shamt/utils` owns small shared helpers for JSON, dates, strings, type guards, cookies, tree processing, scheduling, random values, crypto hashes, sleep, and common TypeScript utility types.

## Boundary Rules

- Keep helpers small, focused, and framework-neutral.
- Prefer pure functions whenever behavior can be expressed as pure logic.
- Avoid app-specific, Shopify-specific, database-specific, or Node-only behavior here.
- Node-only helpers belong in `@shamt/node-utils`.
- Keep runtime-neutral crypto helpers on Web Crypto APIs when possible.

## Implementation Rules

- Other packages should prefer JSON helpers from this package over direct `JSON.parse` and `JSON.stringify`.
- Browser-related helpers must degrade safely in non-browser runtimes through `globalThis` checks.
- Avoid hard DOM type dependencies from the public entry when possible.
- Put shared public TypeScript helper types in `types.ts`.
- Add tests for edge cases, runtime fallbacks, serialization behavior, and type guard behavior.

## Documentation

- README must describe this as a library package: overview, design, inputs/outputs, examples, and runtime notes.
- Include examples for public helpers that are not self-evident.

## Verification

- Run `pnpm -F @shamt/utils test` for behavior changes.
- Run `pnpm -F @shamt/utils build` for export or build changes.
- Run `pnpm -F @shamt/utils lint` after broad TypeScript or Markdown edits.
