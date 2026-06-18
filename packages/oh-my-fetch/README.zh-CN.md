# @shamt/oh-my-fetch

<p><strong>中文</strong> | <a href="./README.md">English</a></p>

`@shamt/oh-my-fetch` 是一个基于 `ky` 的通用 Fetch client。核心保持轻量、安全、运行时中立，业务行为通过显式插件按需加入。

## 设计

- `client`：`HttpClient`、便捷请求方法、插件编排、请求级资源释放。
- `core`：body、query、headers、response parsing、ky options 转换。
- `lifecycle`：可释放 request scope、abort signal 组合、dedupe map 管理。
- `security`：安全 JSON parse、原型污染 key 清理。
- `plugins`：显式 opt-in 策略，例如 business status、request format、error reporter。
- `errors`：`HttpRequestError`、脱敏、ky/fetch 错误归一。
- `validation`：request/response 的可插拔 schema validation。

核心层不理解 UI、业务 response wrapper、日志 provider 或 framework exception。

## 默认行为

- JSON 默认使用 `jsonSecurity: "strict"` 解析。
- 默认不校验 business wrapper。
- 默认不 trim 请求体字符串，也不格式化 Date。
- 只有传入 `bodySchema` 或 `responseSchema` 时才执行 schema validation。
- 默认不启用 dedupe。
- `HttpRequestError.toJSON()` 不输出原始 response data 或 request body。

## 基础用法

```ts
import { createHttpClient } from "@shamt/oh-my-fetch/client";

const api = createHttpClient({
  prefix: "/api",
  timeout: 30 * 1000,
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

传入绝对 URL 时会绕过 `prefix` 和 `baseUrl`，因此同一个 client 也可以直接请求外部服务。

```ts
await api.get("https://api.example.com/status");
```

## 入口

根入口只导出 core client、错误类和共享类型。插件与专项 helper 需要从显式子入口引入。

| 入口                                         | 用途                                    |
| -------------------------------------------- | --------------------------------------- |
| `@shamt/oh-my-fetch`                         | core client、`HttpRequestError`、类型   |
| `@shamt/oh-my-fetch/client`                  | `createHttpClient`、`HttpClient`        |
| `@shamt/oh-my-fetch/errors`                  | `HttpRequestError` 与错误类型           |
| `@shamt/oh-my-fetch/status`                  | HTTP status message helper              |
| `@shamt/oh-my-fetch/validation`              | schema validation helper                |
| `@shamt/oh-my-fetch/json`                    | 安全 JSON parse helper                  |
| `@shamt/oh-my-fetch/dedupe`                  | request dedupe lifecycle helper         |
| `@shamt/oh-my-fetch/plugins/business-status` | business wrapper failure 插件           |
| `@shamt/oh-my-fetch/plugins/error-reporter`  | error reporting 插件                    |
| `@shamt/oh-my-fetch/plugins/request-format`  | request body formatting 插件            |
| `@shamt/oh-my-fetch/plugins/validation`      | request/response schema validation 插件 |
| `@shamt/oh-my-fetch/utils`                   | 更底层的共享 utility types/helper       |

## Query 与 Body

URL 参数使用 `query`，请求体使用 `body`。client 会根据 payload 自动选择 ky 的 `json`、`body` 或 urlencoded 传输字段。

```ts
await api.get<User[]>("users", {
  query: {
    page: 1,
    roles: ["admin", "editor"],
  },
});

await api.post("users", {
  name: " Ada ",
});
```

请求体默认不会被修改。如果某个服务需要递归 trim 字符串和格式化 Date，请显式安装 request-format 插件。

```ts
import { createHttpClient } from "@shamt/oh-my-fetch/client";
import { requestFormatPlugin } from "@shamt/oh-my-fetch/plugins/request-format";

const formattedApi = createHttpClient({
  plugins: [requestFormatPlugin()],
});
```

## Response 类型

默认 `responseType` 是 `json`。

```ts
const text = await api.get<string>("health", {
  responseType: "text",
});

const response = await api.get<Response>("download", {
  responseType: "response",
});
```

使用 `responseType: "response"` 时，返回的 `Response` 会附带 `data` 和脱敏后的 `config`。

## Validation

Validation 内置但惰性执行：只有传入 schema 时才运行。支持 adapter、Standard Schema、Zod-like `safeParse`、Yup-like `validate` 和函数式 validator。

```ts
const user = await api.post(
  "users",
  { id: "1" },
  {
    bodySchema: (value) => ({
      ...(value as Record<string, unknown>),
      id: Number((value as { id: string }).id),
    }),
    responseSchema: (value) => value as User,
  },
);
```

校验失败会抛出 `HttpRequestError`，`kind` 为 `request_validation` 或 `response_validation`。

## Plugins

插件是显式的生命周期策略。

```ts
import { createHttpClient } from "@shamt/oh-my-fetch/client";
import { businessStatusPlugin } from "@shamt/oh-my-fetch/plugins/business-status";
import { errorReporterPlugin } from "@shamt/oh-my-fetch/plugins/error-reporter";
import { requestFormatPlugin } from "@shamt/oh-my-fetch/plugins/request-format";
import { validationPlugin } from "@shamt/oh-my-fetch/plugins/validation";

const api = createHttpClient({
  plugins: [
    validationPlugin(),
    requestFormatPlugin(),
    businessStatusPlugin(),
    errorReporterPlugin({
      report: (error) => {
        console.error(error);
      },
    }),
  ],
});
```

### Business Status

`businessStatusPlugin()` 会把 `{ success: false }` 或 `{ type: "error" }` 这类常见 wrapper 视为失败。传入自定义 validator 时，自定义 validator 会替代默认判断。

```ts
const api = createHttpClient({
  plugins: [
    businessStatusPlugin({
      validator: (data) => {
        const result = data as { ok?: boolean; code?: string };
        if (result.ok === false) {
          return {
            failed: true,
            code: result.code,
            status: 409,
            message: "Custom failure",
            data,
          };
        }
        return false;
      },
    }),
  ],
});
```

### Error Reporting

错误上报是插件，不是 core callback。

```ts
const api = createHttpClient({
  plugins: [
    errorReporterPlugin({
      report: (error, context) => {
        console.error(error.message, context.config);
      },
    }),
  ],
});
```

## Dedupe 与 Dispose

设置 `dedupe: true` 会取消更早的等价 GET/HEAD 请求。也可以传字符串作为自定义 dedupe key，适用于任意方法。

```ts
await api.get("users/current", { dedupe: true });
await api.post("search", body, { dedupe: "search:current" });
```

调用 `dispose()` 会取消 dedupe 管理中的 pending requests，并释放插件资源。

```ts
api.dispose();
```

## JSON 安全

`jsonSecurity` 控制原型污染防护：

- `"strict"`：递归移除 `__proto__`、`constructor`、`prototype`。
- `"shallow"`：只移除顶层危险 key。
- `"off"`：不处理解析后的 JSON。

```ts
const api = createHttpClient({
  defaults: {
    jsonSecurity: "strict",
  },
});
```

## 错误处理

所有归一化失败都使用 `HttpRequestError`。

```ts
import { HttpRequestError } from "@shamt/oh-my-fetch/errors";

try {
  await api.get("users/current");
} catch (error) {
  if (error instanceof HttpRequestError) {
    console.error(error.kind, error.status, error.config);
  }
}
```

稳定的 `kind` 值：

- `http_status`
- `timeout`
- `network`
- `abort`
- `business`
- `request_validation`
- `response_validation`
- `unknown`

错误对象上的 request config 会被脱敏。authorization、cookie、token、password、API key 等敏感 header 和 query value 会被替换成 `[redacted]`；request body 不会以原始值存入 `config`。

## 运行时说明

只要运行时提供 Fetch-compatible globals，这个包就可以工作：浏览器、Cloudflare Workers、Node、serverless isolate 都可以。`Blob`、`FormData`、`ReadableStream`、`AbortController`、上传/下载进度等能力跟随宿主 runtime 和 ky 的支持情况。
