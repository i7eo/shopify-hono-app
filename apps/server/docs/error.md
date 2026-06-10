# Error Design

本文说明服务端错误处理边界。目标是让业务错误、Zod 错误、Hono 错误、上游请求错误和未知异常都进入同一套响应格式。

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

- `code`: HTTP status code。
- `message`: 对外返回的错误说明。
- `success`: 固定为 `false`。
- `data`: 错误响应中默认为 `null`。
- `requestId`: 当前请求 ID。
- `details`: 仅非 production 环境返回，用于调试。

项目不维护额外业务错误码。需要稳定区分错误时，使用稳定的 `message`。

## AppError

`AppError` 是统一错误模型：

```ts
type AppErrorOptions = {
  message?: string;
  status?: number;
  expose?: boolean;
  data?: unknown | null;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
};
```

约定：

- `status` 决定 HTTP 响应码。
- `code` 等于 `status`。
- `expose` 决定是否返回原始 `message`。
- `details` 放调试信息，包括原始错误 `cause`。
- 原始错误不要放在顶层字段，统一放进 `details.cause`。

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
- `payloadTooLargeError`
- `rateLimitError`
- `badGatewayError`
- `serviceUnavailableError`
- `internalServerError`

工厂只负责选择 HTTP status 和默认 `expose` 策略。业务语义由调用方写入 `message`。

## normalizeError

`normalizeError` 负责把任意 thrown value 转成 `AppError`：

- `AppError`: 原样返回。
- `HttpRequestError`: timeout/abort 转 `408`，其他上游错误转 `502`。
- `ZodError`: 转 `422 Validation failed`。
- `HTTPException`: 保留 Hono status 和 message。
- 未知错误: 转 `500 Unhandled application error`。

对应文件：

- `src/shared/exceptions/normalize.ts`
- `src/shared/exceptions/errors.ts`
- `src/shared/models/error.ts`

## Lifecycle

Hono 统一错误入口：

- `src/app/lifecycle/error.ts`
- `src/app/lifecycle/not-found.ts`

`app.onError` 流程：

1. `normalizeError(error)`。
2. 使用 `runtimeLogger` 记录错误；如果 runtime logger 不可用，动态引入默认 logger。
3. `createErrorResponse(c, appError)` 返回 JSON。

`app.notFound` 复用同一套响应生成逻辑。

## 暴露策略

- `4xx` 默认 `expose: true`，返回业务 message。
- `5xx` 默认 `expose: false`，返回 HTTP 标准 phrase。
- 显式设置 `expose: true` 时，即使是 `5xx` 也会返回自定义 message。
- `details` 只在非 production 环境返回。
- 如果无法识别环境，默认不返回 `details`。

这意味着生产环境不会把第三方响应体、stack、token、env 等调试信息返回给调用方；这些信息只进入日志和非 production details。

## 业务代码规则

1. 失败时 `throw xxxError(...)`，不要手写错误 JSON。
2. 不维护项目级错误码。
3. 原始错误统一放入 `details.cause`。
4. 第三方错误正文、stack、环境信息只进入 `details`。
5. 成功响应仍由 route/controller 自己返回。
