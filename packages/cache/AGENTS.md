# Cache Package Instructions

## Scope

`@shamt/cache` owns the shared cache contract and default in-memory implementation.

## Boundary Rules

- Keep this package runtime-neutral enough for shared packages, Node-like runtimes, and web-compatible runtimes.
- Do not add Redis, Cloudflare KV, R2, D1, or app-specific storage clients here.
- Platform-specific cache stores belong in the application layer and should extend the shared `Cache` contract.
- Reuse JSON helpers from `@shamt/utils` for serialization boundaries.

## Implementation Rules

- Keep the `Cache` base contract small and explicit.
- TTL values are always milliseconds.
- `maxSize` values are always bytes.
- Preserve key-prefix normalization behavior.
- Keep implementation helpers in `utils.ts` and shared public types in `types.ts`.
- Prefer fail-fast errors for unimplemented methods or invalid cache values.

## Documentation

- README must describe this as a library package: contract, memory driver, inputs/outputs, examples, and runtime notes.
- Include examples for default factory usage, direct `MemoryCache` usage, and custom store implementation when behavior changes.

## Verification

- Run `pnpm -F @shamt/cache test` for behavior changes.
- Run `pnpm -F @shamt/cache build` for export or build changes.
- Run `pnpm -F @shamt/cache lint` after broad TypeScript or Markdown edits.
