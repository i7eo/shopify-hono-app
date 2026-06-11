# @shamt/node-utils

<!-- eslint-disable unicorn/filename-case, baseline-js/use-baseline -->

<p><a href="./README.zh-CN.md">中文</a> | <strong>English</strong></p>

## Overview

`@shamt/node-utils` contains small Node.js runtime helpers used by this
workspace's process runtime and scripts. It focuses on filesystem probes,
process spawning, monorepo discovery, local network addresses, and graceful
shutdown wiring.

The package is private to the monorepo and is intentionally framework-neutral.
It should not be imported by Cloudflare Worker isolate code because it depends
on Node built-ins such as `child_process`, `fs`, `module`, `os`, `path`, and
`process`.

## Design

- Keep each helper independent and cheap to import.
- Prefer explicit input parameters over hidden global state when practical.
- Avoid string shell execution for command probes and spawning paths.
- Clean up timers and process listeners owned by this package.
- Keep public names stable so app runtime code and scripts can migrate
  gradually from local copies.

## Usage

Check command availability:

```text
import { appExists, appExistsSync } from "@shamt/node-utils";

const hasShopify = await appExists("shopify");
const hasNode = appExistsSync(process.execPath, { args: ["--version"] });
```

Spawn a command with the workspace's cross-platform wrapper:

```text
import { unifiedSpawnAsync } from "@shamt/node-utils";

const code = await unifiedSpawnAsync("pnpm", ["--version"], {
  stdio: "inherit",
});
```

Find the workspace root and load package metadata:

```text
import { findMonorepoRoot, getPackage } from "@shamt/node-utils";

const root = findMonorepoRoot();
const serverPackage = await getPackage("@shamt/server", root);
```

Register process shutdown cleanup:

```text
import { createProcessGracefulExit } from "@shamt/node-utils";

const gracefulExit = createProcessGracefulExit(console);
const cleanup = gracefulExit.createCleanup(server, async () => {
  await disposeProviders();
});

gracefulExit.register(cleanup);
```

Probe filesystem and path values:

```text
import {
  checkProcessDiskAccess,
  formatPath,
  pathExists,
} from "@shamt/node-utils";

await checkProcessDiskAccess(process.cwd());
await pathExists("shopify.app.toml");
formatPath(String.raw`C:\Users\i7eo\app`);
```

Read local host addresses:

```text
import { getLocalhostAddress } from "@shamt/node-utils";

const hosts = getLocalhostAddress();
console.log(hosts);
```

## API

| Export                                         | Description                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `appExists(app, options?)`                     | Async PATH probe for an executable app.                                   |
| `appExistsSync(app, options?)`                 | Sync PATH probe for an executable app.                                    |
| `checkProcessDiskAccess(path?)`                | Verifies read/write access for a path, defaulting to `process.cwd()`.     |
| `executeCommand(command, args?, options?)`     | Runs a command and resolves exit details when it succeeds.                |
| `executeCommandSync(command, args?, options?)` | Sync command runner with the same success/error behavior.                 |
| `formatPath(path)`                             | Converts backslash separators to `/` while leaving Unix paths unchanged.  |
| `createProcessGracefulExit(logger?)`           | Creates isolated process signal registration and shutdown helpers.        |
| `exitSignals`                                  | Supported graceful shutdown signals: `SIGINT`, `SIGQUIT`, `SIGTERM`.      |
| `getLocalhostAddress()`                        | Returns non-internal IPv4 addresses plus `[::]`, with duplicates removed. |
| `findMonorepoRoot(cwd?)`                       | Returns the root discovered by `@manypkg/get-packages`.                   |
| `getPackages(cwd?)`                            | Async wrapper around `@manypkg/get-packages`.                             |
| `getPackagesSync(cwd?)`                        | Sync wrapper around `@manypkg/get-packages`.                              |
| `getPackage(name, cwd?)`                       | Finds one package by `packageJson.name`.                                  |
| `pathExists(path)`                             | Async `fs.access` existence check.                                        |
| `pathExistsSync(path)`                         | Sync `fs.accessSync` existence check.                                     |
| `require`                                      | `createRequire(import.meta.url)` for ESM modules that need Node require.  |
| `unifiedSpawn(command, args?, options?)`       | Cross-platform `spawn` wrapper.                                           |
| `unifiedSpawnAsync(command, args?, options?)`  | Promise wrapper resolving the child close code.                           |
| `unifiedSpawnSync(command, args?, options?)`   | Cross-platform `spawnSync` wrapper.                                       |
| `userHome`                                     | Current `os.homedir()` value.                                             |

## Runtime Notes

- This package is for Node.js runtimes only.
- `appExists` and `unifiedSpawn` hide child windows on Windows and avoid stdio
  allocation unless callers request it.
- `createProcessGracefulExit` removes only listeners it registered, so multiple
  controllers or external signal listeners can coexist.
- `getLocalhostAddress()` is dynamic and reads network interfaces on every call.
