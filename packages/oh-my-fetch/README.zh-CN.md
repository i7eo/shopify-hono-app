# @shamt/oh-my-fetch

<p><strong>中文</strong> | <a href="./README.md">English</a></p>

## 目录

- [介绍](#介绍)
- [设计与架构](#设计与架构)
- [输入与输出](#输入与输出)
- [使用方式](#使用方式)
- [错误处理](#错误处理)
- [运行时说明](#运行时说明)

## 介绍

`@shamt/oh-my-fetch` 是 workspace 的共享 HTTP client 包。它基于 `ky` 做了一层更适合项目使用的收口封装，补充请求体处理、query 序列化、响应解析、retry、timeout、业务 wrapper 校验、schema validation、dedupe 和统一请求错误。

这个包的目标是让 application service 代码保持成功路径：

```ts
const user = await api.get<User>("users/current");
```

传输失败、非 2xx 响应、超时、业务 wrapper 失败、schema 校验失败都会被转换成 `HttpRequestError`，再交给应用自己的全局错误层处理。

## 设计与架构

`@shamt/oh-my-fetch` 的设计原则：

- 保留 `ky` 作为传输引擎，但只暴露 workspace 需要标准化的配置面。
- URL 参数统一使用 `query`，请求体统一使用 `body`，避免直接散落 `searchParams`、`json`、`body` 等底层细节。
- 包本身保持 framework-neutral，不导入 Hono、server exceptions、logger provider 或 runtime env provider。
- 所有请求失败都归一为 `HttpRequestError`，并提供稳定的 `kind` 字段。
- schema validation 保持可插拔，支持 Zod-like、Standard Schema、Yup-like、函数式 validator 和自定义 adapter。
- 保持 `createHttpClient` 作为单一 factory，通过配置表达外部服务与内部 API 的行为差异。

包内分为三层：

- `client`：`HttpClient` 类、请求方法、body 处理、dedupe、响应解析和单一 client factory。
- `errors`：`HttpRequestError`、脱敏、业务 wrapper 判断，以及 ky/fetch 错误归一。
- `validation`：schema adapter，将 request/response 校验失败转换为 `HttpRequestError`。

## 输入与输出

输入：

- `ky` 支持的 URL input。
- 请求配置，例如 `query`、`headers`、`timeout`、`retry`、`signal`、`responseType`、`bodySchema`、`responseSchema`。
- JSON-like object、string、`FormData`、`URLSearchParams`、`Blob`、`ArrayBuffer`、stream 等请求体。
- 可选业务 wrapper validator 和生命周期 hooks。

输出：

- 默认返回解析后的响应数据。
- 当使用 `responseType: "response"` 时，返回带 `data` 和脱敏 `config` 的 response 对象。
- 所有归一化请求失败都会抛出 `HttpRequestError`。

## 使用方式

创建通用 client：

```ts
import { createHttpClient } from "@shamt/oh-my-fetch";

const api = createHttpClient({
  prefix: "/api",
  timeout: 30_000,
  headers: {
    accept: "application/json",
  },
});

type User = {
  id: string;
  name: string;
};

const user = await api.get<User>("users/current");
```

调用不使用 workspace success/error wrapper 的外部服务时，仍然使用同一个 factory，并通过配置关闭业务 wrapper 校验：

```ts
import { createHttpClient } from "@shamt/oh-my-fetch";

const google = createHttpClient({
  timeout: 3_000,
  retry: { limit: 0 },
  defaults: {
    validateBusinessStatus: false,
  },
});

const response = await google.get<Response>(
  "https://www.google.com/generate_204",
  {
    responseType: "response",
  },
);
```

调用使用 workspace wrapper 的内部 API 时，也使用同一个 factory。默认行为会把 `{ success: false }` 视为错误：

```ts
import { createHttpClient } from "@shamt/oh-my-fetch";

const internalApi = createHttpClient({
  prefix: "/api",
});

const result = await internalApi.post("jobs", {
  type: "sync-products",
});
```

使用 `businessStatusValidator` 处理自定义业务 code：

```ts
import { createHttpClient } from "@shamt/oh-my-fetch";

const api = createHttpClient({
  prefix: "/api",
  defaults: {
    businessStatusValidator: (data) => {
      const result = data as {
        code?: number | string;
        message?: string;
        success?: boolean;
      };

      if (result.code === "SHOP_LOCKED") {
        return {
          failed: true,
          code: result.code,
          status: 423,
          message: "Shop is locked",
          data,
        };
      }

      if (result.code === 10001 || result.code === "10001") {
        return {
          failed: true,
          code: result.code,
          status: 409,
          message: "Product sync is already running",
          data,
        };
      }

      if (result.success === false) {
        return {
          failed: true,
          code: result.code,
          message: result.message,
          data,
        };
      }

      return false;
    },
  },
});

await api.post("jobs", {
  type: "sync-products",
});
```

应用层需要展示 UI 提示时，使用 `onErrorMessage` 接收归一后的错误消息：

```ts
const api = createHttpClient({
  prefix: "/api",
  defaults: {
    onErrorMessage: (message, { error }) => {
      if (error.name === "HttpRequestError") {
        showToast(message);
      }
    },
  },
});
```

应用层需要把 `HttpRequestError` 转换为自己的错误模型时，使用 `hooks.beforeError` 作为 adapter 入口：

```ts
const api = createHttpClient({
  hooks: {
    beforeError: (error) => {
      if (error.name !== "HttpRequestError") {
        return error;
      }

      return mapRequestErrorToAppError(error);
    },
  },
});
```

`businessStatusValidator` 是业务 code 规则继续增长时的单一扩展点。它可以返回 `true`，表示使用当前响应数据作为业务失败；也可以返回 `BusinessFailureResult`，自行提供 status、message、code 和 data。

通过 `query` 传递 URL 参数：

```ts
const users = await api.get<User[]>("users", {
  query: {
    page: 1,
    pageSize: 20,
    roles: ["admin", "editor"],
  },
});
```

使用任意支持的 schema 形态校验请求或响应：

```ts
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const user = await api.get("users/current", {
  responseSchema: UserSchema,
});
```

上传文件时使用 `FormData`，不要手动设置 `Content-Type`，因为 multipart boundary 必须交给 Fetch 自动生成：

```ts
const result = await api.upload("assets", {
  file,
  fieldName: "image",
  filename: "cover.png",
});
```

## 错误处理

所有归一化后的失败都会使用 `HttpRequestError` 表示：

```ts
import { HttpRequestError } from "@shamt/oh-my-fetch";

try {
  await api.get("users/current");
} catch (error) {
  if (error instanceof HttpRequestError) {
    console.error(error.kind, error.status, error.config);
  }
}
```

`kind` 字段稳定，可以被应用层 adapter 使用：

- `http_status`：上游返回非 2xx 响应。
- `timeout`：请求超时。
- `network`：请求在收到响应前失败。
- `abort`：请求被取消。
- `business`：响应 wrapper 被判断为业务失败。
- `request_validation`：请求体 schema 校验失败。
- `response_validation`：解析后的响应 schema 校验失败。
- `unknown`：未预期错误的兜底分类。

`HttpRequestError.config` 会在保存前脱敏。authorization、cookie、token、password、api key 等敏感 header 和 query value 会被替换为 `[redacted]`。

## 运行时说明

`@shamt/oh-my-fetch` 对 process-style 和 isolate-style runtime 都保持中立，只要运行时提供 Fetch-compatible API 即可。它可以用于 Node、Cloudflare Workers、Vercel 类 serverless 环境和浏览器。

部分能力取决于具体运行时：

- `Blob`、`FormData`、`ReadableStream`、`AbortController` 都通过 global API 检测。
- 上传和下载进度能力跟随 `ky` 与底层 runtime 支持情况。
- JSON 默认 parser 会丢弃 `__proto__`、`constructor`、`prototype` 等 key。只有当上游 API 确实需要这些字段时，才建议覆盖 `parseJson`。
