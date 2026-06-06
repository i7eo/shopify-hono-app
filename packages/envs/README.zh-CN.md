# @shamt/envs

<p><strong>中文</strong> | <a href="./README.md">English</a></p>

## 目录

- [介绍](#介绍)
- [设计与架构](#设计与架构)
- [输入与输出](#输入与输出)
- [使用方式](#使用方式)
- [单位约定](#单位约定)

## 介绍

`@shamt/envs` 是项目级环境常量与 Zod 配置 schema 包。它集中维护跨应用共享的默认值、运行环境枚举、运行时枚举、HTTP 状态码、响应默认结构、日志配置、缓存配置、数据库配置、Redis 配置等。

这个包不读取 `process.env`，也不负责判断当前部署平台。它只提供可复用的常量、类型和 schema，让业务应用在自己的 bootstrap、runtime env provider 或中间件中完成实际解析。

## 设计与架构

`@shamt/envs` 的设计目标是让环境配置有清晰边界：

- `constants`: 只放稳定默认值和枚举式常量，例如 `DEFAULT_ENVS`、`DEFAULT_RUNTIMES`、`HTTP_STATUS_CODES`、`RESPONSE_SUCCESS_CODE`。
- `configs`: 使用 Zod 描述可解析的环境变量结构，例如 `appConfigSchema`、`envConfigSchema`、`logConfigSchema`。
- `utils`: 提供 schema 组合工具，例如 `extendConfigSchema`。

Schema 只负责验证和默认值，不绑定 Node、Cloudflare Workers、Vercel 或 Bun。不同 runtime 可以把自己的 raw env 对象传入 schema，再得到统一的 typed config。

包内刻意使用 const object 而不是 TypeScript `enum`，这样运行时值与 TypeScript 字面量类型可以保持一致。

## 输入与输出

输入：

- 类环境变量对象，例如 `process.env`、Cloudflare Worker bindings，或应用层合并后的 runtime config 对象。
- 需要与共享 schema 组合的 Zod object schema。

输出：

- app、cache、database、env、logger、Redis 等配置的 Zod schema。
- `AppConfigSchema`、`EnvConfigSchema`、`LogConfigSchema` 等 TypeScript 推导类型。
- HTTP 状态码、响应默认值、content type、runtime 名称、env 名称、超时时间、大小限制等共享常量。

## 使用方式

解析标准 runtime env 字段：

```ts
import { envConfigSchema } from "@shamt/envs";

const config = envConfigSchema.parse({
  APP_ENV: "development",
  APP_RUNTIME: "cloudflare",
});

config.APP_ENV; // "development"
config.APP_RUNTIME; // "cloudflare"
```

组合项目自己的配置 schema：

```ts
import {
  appConfigSchema,
  envConfigSchema,
  extendConfigSchema,
} from "@shamt/envs";
import { z } from "zod";

const serverSchema = extendConfigSchema(
  extendConfigSchema(envConfigSchema, appConfigSchema),
  z.object({
    SHOPIFY_APP_KEY: z.string().min(1),
  }),
);

const serverConfig = serverSchema.parse(process.env);
```

使用共享 HTTP 状态码与响应默认值：

```ts
import {
  HTTP_STATUS_CODES,
  RESPONSE_SUCCESS_CODE,
  RESPONSE_SUCCESS_MESSAGE,
  RESPONSE_SUCCESS_OK,
} from "@shamt/envs";

const response = {
  code: RESPONSE_SUCCESS_CODE,
  message: RESPONSE_SUCCESS_MESSAGE,
  success: RESPONSE_SUCCESS_OK,
  data: { status: HTTP_STATUS_CODES.OK.phrase },
};
```

使用 runtime 常量，避免散落字符串字面量：

```ts
import { DEFAULT_RUNTIMES, type DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";

function isCloudflare(runtime: DEFAULT_RUNTIMES_VALUES) {
  return runtime === DEFAULT_RUNTIMES.CLOUDFLARE;
}
```

## 单位约定

1. 时间单位默认均为毫秒。
2. 文件大小与内存大小单位默认均为字节。
