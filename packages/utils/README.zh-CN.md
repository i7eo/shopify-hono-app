# @shamt/utils

<p><strong>中文</strong> | <a href="./README.md">English</a></p>

## 目录

- [介绍](#介绍)
- [设计与架构](#设计与架构)
- [输入与输出](#输入与输出)
- [使用方式](#使用方式)
- [运行时说明](#运行时说明)

## 介绍

`@shamt/utils` 是 workspace 的共享工具包。它提供一组小而聚焦的工具函数，覆盖 JSON 序列化、日期、字符串、运行时判断、类型守卫、cookie、树结构处理、基于 raf 的调度、随机值、sleep，以及常见 TypeScript 工具类型。

这个包既可以被应用代码直接使用，也可以被其他 workspace 包复用，例如 `@shamt/cache`。

## 设计与架构

`@shamt/utils` 的设计原则：

- 工具函数保持小而独立，不绑定具体框架。
- 能写成纯函数的逻辑优先保持纯函数。
- JSON 序列化边界统一放在 `json.ts`，其他包不要直接调用 `JSON.parse` / `JSON.stringify`。
- 公共入口避免强依赖 DOM 类型，让 Node、Workers、浏览器构建都能完成类型检查。
- 通过包入口统一 re-export 部分外部工具，例如 `es-toolkit` 和 `nanoid`。

`cookie.ts`、`raf.ts` 这类浏览器能力相关工具会基于 `globalThis` 做运行时检测。它们可以被非浏览器环境 import，但当缺少对应全局 API 时，会返回空值、执行 no-op，或退化到兼容实现。

## 输入与输出

输入：

- primitive、object、array、date、JSON string、tree node、callback、cookie name/value 等。
- 可选配置对象，例如 cookie attributes、tree 字段映射、随机数生成选项。

输出：

- JSON 解析结果或序列化字符串。
- 格式化后的日期字符串。
- 类型守卫判断结果。
- 树遍历结果与转换后的树结构。
- 浏览器环境中的 cookie 字符串或 cookie 值。
- raf 调度工具返回的 cancel 函数。
- 常见类型转换所需的 TypeScript helper type。

## 使用方式

使用 JSON helper 作为共享序列化边界：

```ts
import { deserializeValue, serializeValue } from "@shamt/utils";

const raw = serializeValue({ id: "shop_1", enabled: true });
const parsed = deserializeValue<{ id: string; enabled: boolean }>(raw);
```

使用类型守卫过滤数组：

```ts
import { notNullish } from "@shamt/utils";

const values = ["a", null, "b", undefined].filter(notNullish);
// string[]
```

使用日期工具：

```ts
import { diffDays, formatToDateTime, previousDay } from "@shamt/utils";

formatToDateTime(new Date());
diffDays("2026-06-07", "2026-06-01");
previousDay("2026-06-07");
```

在浏览器环境中使用 cookie 工具：

```ts
import { Cookies, getCookieJSON, setCookieJSON } from "@shamt/utils";

Cookies.set("locale", "en-US", { sameSite: "lax" });
const locale = Cookies.get("locale");

setCookieJSON("settings", { density: "compact" });
const settings = getCookieJSON<{ density: string }>("settings");
```

使用树结构工具：

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

使用 raf 调度工具：

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

## 运行时说明

`@shamt/utils` 目标是能被 shared code 使用，但部分工具仍依赖特定运行时能力：

- Cookie 工具需要浏览器式 `document.cookie`；在非浏览器环境中会返回空值或 no-op。
- raf 工具优先使用 `requestAnimationFrame`，不存在时退化为 `setTimeout`。
- JSON helper 与运行时无关，workspace 内其他包应优先使用它们，而不是直接调用 `JSON.parse` / `JSON.stringify`。
