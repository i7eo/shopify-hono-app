# @shamt/utils

<p><a href="./README.zh-CN.md">中文</a> | <strong>English</strong></p>

## Table of Contents

- [Overview](#overview)
- [Design and Architecture](#design-and-architecture)
- [Inputs and Outputs](#inputs-and-outputs)
- [Usage](#usage)
- [Runtime Notes](#runtime-notes)

## Overview

`@shamt/utils` is the shared utility package for the workspace. It provides small and focused helpers for JSON serialization, dates, strings, runtime checks, type guards, cookies, tree processing, raf-based scheduling, random values, sleep, and common TypeScript utility types.

This package can be used directly by application code and reused by other workspace packages, such as `@shamt/cache`.

## Design and Architecture

`@shamt/utils` follows these design principles:

- Keep helpers small and independent, without binding them to a specific framework.
- Prefer pure functions whenever the behavior can be expressed as pure logic.
- Keep JSON serialization boundaries in `json.ts`; other packages should avoid direct `JSON.parse` / `JSON.stringify` calls.
- Avoid hard DOM type dependencies from the public entry, so Node, Workers, and browser builds can all type-check.
- Re-export selected external utilities such as `es-toolkit` and `nanoid` from the package entry.

Browser-related helpers such as `cookie.ts` and `raf.ts` use runtime checks based on `globalThis`. They can be imported in non-browser environments, but when the required global API is missing, they return empty values, no-op, or fall back to compatible behavior.

## Inputs and Outputs

Inputs:

- Primitive values, objects, arrays, dates, JSON strings, tree nodes, callbacks, cookie names, and cookie values.
- Optional configuration objects, such as cookie attributes, tree field mappings, and random number options.

Outputs:

- JSON parse results or serialized strings.
- Formatted date strings.
- Type guard boolean results.
- Tree traversal results and transformed tree structures.
- Cookie strings or cookie values in browser runtimes.
- Cancel functions returned by raf scheduling helpers.
- TypeScript helper types for common type transformations.

## Usage

Use JSON helpers as the shared serialization boundary:

```ts
import { deserializeValue, serializeValue } from "@shamt/utils";

const raw = serializeValue({ id: "shop_1", enabled: true });
const parsed = deserializeValue<{ id: string; enabled: boolean }>(raw);
```

Use type guards to filter arrays:

```ts
import { notNullish } from "@shamt/utils";

const values = ["a", null, "b", undefined].filter(notNullish);
// string[]
```

Use date helpers:

```ts
import { diffDays, formatToDateTime, previousDay } from "@shamt/utils";

formatToDateTime(new Date());
diffDays("2026-06-07", "2026-06-01");
previousDay("2026-06-07");
```

Use cookie helpers in browser runtimes:

```ts
import { Cookies, getCookieJSON, setCookieJSON } from "@shamt/utils";

Cookies.set("locale", "en-US", { sameSite: "lax" });
const locale = Cookies.get("locale");

setCookieJSON("settings", { density: "compact" });
const settings = getCookieJSON<{ density: string }>("settings");
```

Use tree helpers:

```ts
import { findNode, listToTree, traverseTree } from "@shamt/utils";

const tree = listToTree([
  { id: 1, pid: 0, name: "Root" },
  { id: 2, pid: 1, name: "Child" },
]);

const child = findNode<{ id: number; name: string }>(
  tree,
  (node) => node.id === 2,
);

const names = traverseTree(tree, (node: any) => ({
  match: true,
  result: node.name,
}));
```

Use raf scheduling helpers:

```ts
import { rafDebounce, rafSetTimeout } from "@shamt/utils";

const cancelTimeout = rafSetTimeout(() => {
  console.log("run once");
}, 300);

const onResize = rafDebounce(() => {
  console.log("resize settled");
}, 200);

cancelTimeout();
onResize.cancel();
```

## Runtime Notes

`@shamt/utils` is designed for shared code, but some helpers still depend on specific runtime capabilities:

- Cookie helpers require browser-like `document.cookie`; in non-browser environments they return empty values or no-op.
- raf helpers prefer `requestAnimationFrame` and fall back to `setTimeout` when it is unavailable.
- JSON helpers are runtime-neutral. Other workspace packages should prefer them over direct `JSON.parse` / `JSON.stringify` calls.
