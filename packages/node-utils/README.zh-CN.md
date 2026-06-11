# @shamt/node-utils

<!-- eslint-disable unicorn/filename-case, baseline-js/use-baseline -->

<p><strong>中文</strong> | <a href="./README.md">English</a></p>

## 介绍

`@shamt/node-utils` 提供一组面向 Node.js 运行时的小工具，主要服务于本
workspace 的 process runtime 和脚本逻辑。它覆盖文件系统探测、进程启动、
monorepo 根目录发现、本机网络地址读取，以及进程优雅退出注册。

这个包是 monorepo 内部私有包，保持框架无关。由于依赖 `child_process`、
`fs`、`module`、`os`、`path`、`process` 等 Node 内置模块，不应在
Cloudflare Worker isolate 代码中导入。

## 设计原则

- 每个 helper 独立、轻量，避免导入时做昂贵工作。
- 在可行的地方优先接受显式参数，减少对全局 `process.cwd()` 的隐式依赖。
- 命令探测和进程启动避免字符串拼接式 shell 执行。
- 清理自身创建的 timer 和 process listener，避免长期运行进程里的泄漏。
- 保持公开导出名称稳定，方便应用运行时代码和脚本从本地副本逐步迁移。

## 使用方式

检查命令是否可用：

```text
import { appExists, appExistsSync } from "@shamt/node-utils";

const hasShopify = await appExists("shopify");
const hasNode = appExistsSync(process.execPath, { args: ["--version"] });
```

使用跨平台 spawn 包装：

```text
import { unifiedSpawnAsync } from "@shamt/node-utils";

const code = await unifiedSpawnAsync("pnpm", ["--version"], {
  stdio: "inherit",
});
```

查找 workspace 根目录并读取 package 元数据：

```text
import { findMonorepoRoot, getPackage } from "@shamt/node-utils";

const root = findMonorepoRoot();
const serverPackage = await getPackage("@shamt/server", root);
```

注册进程退出清理：

```text
import { createProcessGracefulExit } from "@shamt/node-utils";

const gracefulExit = createProcessGracefulExit(console);
const cleanup = gracefulExit.createCleanup(server, async () => {
  await disposeProviders();
});

gracefulExit.register(cleanup);
```

探测文件系统和路径：

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

读取本机 host 地址：

```text
import { getLocalhostAddress } from "@shamt/node-utils";

const hosts = getLocalhostAddress();
console.log(hosts);
```

## API

| 导出                                           | 说明                                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| `appExists(app, options?)`                     | 异步探测 PATH 中是否存在可执行 app。                 |
| `appExistsSync(app, options?)`                 | 同步探测 PATH 中是否存在可执行 app。                 |
| `checkProcessDiskAccess(path?)`                | 检查路径读写权限，默认使用 `process.cwd()`。         |
| `executeCommand(command, args?, options?)`     | 执行命令，成功时返回退出信息。                       |
| `executeCommandSync(command, args?, options?)` | 同步执行命令，成功和失败行为与异步版本一致。         |
| `formatPath(path)`                             | 将反斜杠路径分隔符转换为 `/`，Unix 路径保持不变。    |
| `createProcessGracefulExit(logger?)`           | 创建隔离的进程信号注册和 shutdown helper。           |
| `exitSignals`                                  | 支持优雅退出的信号：`SIGINT`、`SIGQUIT`、`SIGTERM`。 |
| `getLocalhostAddress()`                        | 返回非 internal IPv4 地址和 `[::]`，并去重。         |
| `findMonorepoRoot(cwd?)`                       | 返回 `@manypkg/get-packages` 发现的 root。           |
| `getPackages(cwd?)`                            | `@manypkg/get-packages` 的异步包装。                 |
| `getPackagesSync(cwd?)`                        | `@manypkg/get-packages` 的同步包装。                 |
| `getPackage(name, cwd?)`                       | 按 `packageJson.name` 查找单个 package。             |
| `pathExists(path)`                             | 基于 `fs.access` 的异步存在性检查。                  |
| `pathExistsSync(path)`                         | 基于 `fs.accessSync` 的同步存在性检查。              |
| `require`                                      | 面向 ESM 模块的 `createRequire(import.meta.url)`。   |
| `unifiedSpawn(command, args?, options?)`       | 跨平台 `spawn` 包装。                                |
| `unifiedSpawnAsync(command, args?, options?)`  | Promise 包装，resolve 子进程 close code。            |
| `unifiedSpawnSync(command, args?, options?)`   | 跨平台 `spawnSync` 包装。                            |
| `userHome`                                     | 当前 `os.homedir()` 值。                             |

## 运行时说明

- 这个包只面向 Node.js runtime。
- `appExists` 和 `unifiedSpawn` 在 Windows 下隐藏子窗口，并且默认不分配 stdio。
- `createProcessGracefulExit` 只移除自己注册的 listener，允许多个 controller
  或外部 signal listener 共存。
- `getLocalhostAddress()` 每次调用都会重新读取网络接口。
