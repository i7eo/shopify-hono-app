# TanStack Router - React Query File-Based Example

An example combining file-based routing with TanStack Query integration.

- [TanStack Router Docs](https://tanstack.com/router)
- [TanStack Query Docs](https://tanstack.com/query)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/basic-react-query-file-based basic-react-query-file-based
```

## Getting Started

Install dependencies:

```sh
pnpm install
```

Start the development server:

```sh
pnpm dev
```

## Build

Build for production:

```sh
pnpm build
```

## About This Example

This example demonstrates:

- File-based routing with TanStack Router
- TanStack Query integration
- Type-safe data fetching
- Automatic route generation
- Query-based data loading per route

## Vite Config and `tsx/esm`

If `vite.config.ts` imports workspace TypeScript packages such as
`@shamt/utils`, the dev server can be started with:

```sh
NODE_OPTIONS="--import tsx/esm" vite
```

This preloads the `tsx` ESM loader before Vite loads `vite.config.ts`. The
loader lets Node execute TypeScript files directly and resolve extensionless
workspace imports such as `export * from "./base"` to the matching `.ts` source
file.

Pros:

- Allows `vite.config.ts` to import workspace TS packages directly during local
  development.
- Avoids building those workspace packages before starting Vite.
- Keeps config code reusable, for example by importing shared helpers such as
  HTML escaping utilities.

Cons:

- It is a dev-time loader workaround, not a package-level ESM compatibility fix.
- Other Node entry points that do not preload `tsx/esm` can still fail on
  extensionless ESM imports.
- Production builds, scripts, tests, or external tools may behave differently if
  they load the same workspace package without this loader.
- It adds startup behavior that must be remembered anywhere `vite.config.ts` is
  executed.

Long term, shared workspace packages should prefer Node-compatible ESM
specifiers such as `export * from "./base.js"` in TypeScript source. TypeScript
can compile that pattern cleanly, and the emitted JavaScript then resolves
without relying on a custom loader.
