---
name: monorepo-readme-writer
description: Use when writing or updating README.md files for a monorepo, especially pnpm workspaces. Generates a root README with clickable links to workspace packages, package-family sections, architecture logic, development workflow, and package-level READMEs that follow each package's role and public API.
metadata:
  short-description: Write monorepo README files
---

# Monorepo README Writer

Use this skill to write a coherent README system for a monorepo:

1. Root `README.md`
2. Category READMEs, when useful
3. Package-level `README.md` files

The style follows the Shopify `shopify-app-js` pattern: route readers by intent, group packages by role, explain architecture by dependency layers, and keep deep setup details inside each package.

## Workflow

1. Discover the workspace structure.
   - Read `pnpm-workspace.yaml`, root `package.json`, and package `package.json` files.
   - Use workspace globs to enumerate packages.
   - Identify package groups from paths, names, dependency direction, source boundaries, and package purpose.

2. Build the package map.
   - For each package, capture package name, relative path, public/private status, one-sentence purpose, key dependencies, and package type.
   - Common package types: low-level client, core library, framework adapter, storage adapter, tooling, test utility, example, or private internal package.

3. Write or update the root README.
   - Start with the repo purpose and target developer.
   - Add package sections grouped by user intent, not only filesystem layout.
   - Use clickable relative links to package directories or package READMEs.
   - Include a package table per group.
   - Explain architecture and dependency direction.
   - Include development commands for install, build, test, package-local work, and local package consumption when relevant.

4. Write or update package READMEs.
   - Keep each package README focused on that package.
   - Include installation, minimal setup, public API/configuration, usage examples, and gotchas where relevant.
   - Do not duplicate the entire root architecture in every package README.
   - Link back to related packages or shared interfaces when helpful.

5. Validate link and content consistency.
   - Ensure every root README package link resolves.
   - Ensure package names in README tables match `package.json`.
   - Ensure private packages are labeled or omitted intentionally.
   - Ensure package descriptions match dependency direction and actual source boundaries.

## Root README Pattern

Use this outline unless the repo strongly suggests another:

````markdown
# <Repo / product family name>

This repository contains <what it contains>. Use these packages to <primary outcome>.

It is organized as a monorepo with packages that can be used independently or together.

## Packages

### <Package group by user intent>

These packages help you <goal>.

| Package                            | Version              | Description           |
| ---------------------------------- | -------------------- | --------------------- |
| [`<name>`](./relative/path#readme) | npm badge or version | One-sentence purpose. |

### <Next group>

...

## Architecture

Explain dependency direction in prose or a small diagram:

`low-level package` -> `domain/core package` -> `framework/adapters` -> `storage/infrastructure adapters`

Name shared interfaces and identify which packages implement, wrap, or depend on them.

## Developing in this repo

```bash
pnpm install
pnpm build
pnpm test
```
````

Explain package-local build/test commands if packages depend on generated `dist` output.

## Testing a local package in an app

Show a `file:` or workspace-aware local install flow if applicable.

````

## Root README Link Rules

- Link package names with relative links: ``[`@scope/pkg`](./packages/group/pkg#readme)``.
- Prefer links to package folders with `#readme`, so GitHub opens that README naturally.
- Use category README links only for category headings.
- Do not link to npm as the primary package link; npm badges can link to npm.
- If a package lacks README, either create one or link to the folder only if it contains useful source docs.
- Keep root package descriptions short enough to scan.

## Package README Pattern

Use this default package README outline:

```markdown
# `<package-name>`

One paragraph explaining what this package does and who should use it.

## Getting started

Install command and minimal setup.

## Configuration

Document required config fields with a table when the package exposes configuration.

## Usage examples

Show common tasks in increasing complexity.

## API

Document important exports, methods, response shapes, or interfaces.

## Gotchas / Troubleshooting

Only include issues users are likely to hit.
````

## Package Type Guidance

For low-level API/client packages:

- Explain required credentials or tokens.
- Show client initialization.
- Document request methods, options, retries, custom fetch, response shape, and errors.
- Include typed usage if TypeScript is central.

For core libraries:

- Explain framework/runtime independence.
- Document initialization.
- Explain major capabilities such as auth, sessions, webhooks, billing, clients, or runtime adapters.
- Link to deeper reference docs instead of bloating README.

For framework adapters:

- Explain which core package is wrapped.
- Show required routes, middleware/hooks, server config, frontend provider, headers, and testing helpers.
- Call out framework version requirements and migration status.

For storage or infrastructure adapters:

- State the shared interface implemented.
- Show constructor options.
- Document schema/table/namespace requirements.
- Call out migrations, refresh-token support, local-development caveats, and production warnings.

For tooling/codegen packages:

- Explain what files are generated and why.
- Show minimal config.
- Document exported helpers from low-level to high-level convenience APIs.
- Include multi-project examples only when common.

## Writing Rules

- Organize by reader intent first, filesystem second.
- Make root README navigational and architectural.
- Put package setup details in package READMEs.
- Keep package table descriptions to one sentence.
- Use consistent section names across similar packages.
- Explain how packages compose, not just what directories exist.
- Preserve existing accurate warnings, migration notes, and production caveats.
- Escape or quote package names exactly as in `package.json`.
- Do not invent npm package status; read `package.json`.
- Do not list private internal packages as public user-facing packages unless the repo already does.
