# Error Design

本文说明服务端错误处理的设计边界。目标是让项目中抛出的错误，无论来自 HTTP、Zod、database、runtime、第三方 API，最终都进入统一的异常处理流程。

## 目标

错误处理只做三件事：

1. 业务代码表达发生了什么错误。
2. `exceptions` 将任意错误规范化为 `AppError`。
3. lifecycle 中的 `app.onError` / `app.notFound` 统一记录日志并返回响应。

业务模块不直接拼接错误响应，不维护项目级错误码，也不在每个 route 中重复处理生产环境是否暴露细节。

## 响应格式

错误响应保持简单：

```json
{
  "code": 400,
  "message": "Invalid shop domain",
  "success": false,
  "data": null,
  "requestId": "..."
}
```

字段说明：

- `code`: HTTP 标准状态码，例如 `400`、`401`、`422`、`500`。
- `message`: 业务方写入的错误标识或错误说明。
- `success`: 固定为 `false`。
- `data`: 错误响应中默认为 `null`。
- `requestId`: 当前请求 ID，便于关联日志。
- `details`: 仅在非 production 环境返回，用于调试。

项目不再维护额外的 `errorCode`。如果业务需要区分错误，直接写入稳定的 `message`。
请求路径 `path` 不进入响应体，只写入错误日志，用于排查和链路定位。

## AppError

`AppError` 是项目内部统一错误模型：

```ts
type AppErrorOptions = {
  message?: string;
  status?: number;
  expose?: boolean;
  data?: unknown | null;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
  requestId?: string;
  stack?: string;
};
```

约定：

- `status` 决定 HTTP 响应码。
- `code` 等于 `status`，不再承载业务错误码。
- `message` 是业务错误标识，也是可暴露错误说明。
- `expose` 决定生产环境是否返回原始 `message`。
- `details` 放调试信息，包括原始错误 `cause`。
- `cause` 不作为顶层字段存在，统一放入 `details.cause`。

## 错误工厂

业务代码通过 HTTP 标准错误工厂抛错：

```ts
throw badRequestError("Invalid shop domain");
throw unauthorizedError("Invalid session token");
throw badGatewayError("Token exchange failed", {
  details: {
    cause: error,
    message: error instanceof Error ? error.message : String(error),
  },
});
```

常用工厂：

- `badRequestError`
- `unauthorizedError`
- `forbiddenError`
- `notFoundError`
- `unprocessableEntityError`
- `timeoutError`
- `conflictError`
- `rateLimitError`
- `badGatewayError`
- `serviceUnavailableError`
- `internalServerError`

工厂只负责选择 HTTP status 和默认 `expose` 策略。业务含义由调用方写入 `message`。

## details 与 cause

所有原始错误统一放入 `details.cause`：

```ts
throw internalServerError("runtime env 获取报错", {
  details: {
    cause: error,
    message: error instanceof Error ? error.message : String(error),
  },
  expose: true,
});
```

这样做的原因：

- `details` 是唯一的调试信息边界。
- 生产环境默认不返回 `details`，避免泄露第三方错误、堆栈、token 或环境信息。
- 日志仍然可以记录完整 details，便于排查。

## normalizeError

`normalizeError` 负责把任意错误转换成 `AppError`：

- `AppError`: 原样返回。
- `ZodError`: 转成 `422 Unprocessable Entity`。
- `HTTPException`: 保留原 HTTP status 和 message。
- 未知错误: 转成 `500 Internal Server Error`。

这保证所有错误最终都能交给同一个 response builder。

## lifecycle

Hono 错误入口放在 app lifecycle 中：

- `app/lifecycle/error.ts`: 注册 `app.onError`。
- `app/lifecycle/not-found.ts`: 注册 `app.notFound`。

`app.onError` 的职责：

1. 调用 `normalizeError(error)`。
2. 使用 `runtimeLogger` 记录错误；如果 logger 不可用，则 fallback 到 `console.error`。
3. 调用 `createErrorResponse(c, appError)` 返回统一 JSON。

`app.notFound` 的职责：

1. 构造 `notFoundError(...)`。
2. 复用统一响应生成逻辑。

## 暴露策略

默认策略：

- `4xx` 错误默认 `expose: true`，返回业务 message。
- `5xx` 错误默认 `expose: false`，生产环境返回 HTTP phrase。
- `details` 仅在非 production 环境返回。
- 环境无法识别时，不返回 `details`。

如果确实需要暴露某个 runtime 初始化错误，可以显式设置：

```ts
throw internalServerError("runtime logger 获取报错", {
  details: { cause: error, message },
  expose: true,
});
```

## 业务代码规则

业务代码遵循以下规则：

1. 失败时 `throw xxxError(...)`，不要手写 `return c.json({ error })`。
2. 不维护项目级错误码。
3. 不把原始错误放在顶层 `cause`，只放入 `details.cause`。
4. 第三方错误正文、stack、环境信息只进入 `details`。
5. 成功响应仍由业务 route 自己返回。
