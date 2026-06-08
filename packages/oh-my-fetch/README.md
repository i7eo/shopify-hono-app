# @shamt/oh-my-fetch

<p><a href="./README.zh-CN.md">中文</a> | <strong>English</strong></p>

## Table of Contents

- [Overview](#overview)
- [Design and Architecture](#design-and-architecture)
- [Inputs and Outputs](#inputs-and-outputs)
- [Usage](#usage)
- [Error Handling](#error-handling)
- [Runtime Notes](#runtime-notes)

## Overview

`@shamt/oh-my-fetch` is the shared HTTP client package for the workspace. It wraps `ky` with a smaller project-facing API and adds common behavior for request bodies, query serialization, response parsing, retry, timeout, business wrapper checks, schema validation, dedupe, and normalized request errors.

The package is designed for application services that should read like a success path:

```ts
const user = await api.get<User>("users/current");
```

Transport failures, non-2xx responses, timeout errors, business wrapper failures, and validation failures are converted into `HttpRequestError` and can be handled by the application's global error layer.

## Design and Architecture

`@shamt/oh-my-fetch` follows these design principles:

- Keep `ky` as the transport engine and expose only the options this workspace wants to standardize.
- Use `query` for URL parameters and a single `body` field for request bodies instead of exposing `searchParams`, `json`, and `body` separately.
- Keep the package framework-neutral. It does not import Hono, server exceptions, logger providers, or runtime env providers.
- Normalize every request failure into `HttpRequestError` with a stable `kind` field.
- Keep schema validation pluggable. Zod-like schemas, Standard Schema, Yup-like schemas, functions, and custom adapters are supported.
- Keep `createHttpClient` as the single factory and express upstream/internal behavior through configuration.

The package has three layers:

- `client`: the `HttpClient` class, request helpers, body handling, dedupe, parsing, and the single client factory.
- `errors`: `HttpRequestError`, redaction, business wrapper detection, and ky/fetch error normalization.
- `validation`: schema adapters that turn request or response validation failures into `HttpRequestError`.

## Inputs and Outputs

Inputs:

- URL inputs accepted by `ky`.
- Request configuration such as `query`, `headers`, `timeout`, `retry`, `signal`, `responseType`, `bodySchema`, and `responseSchema`.
- Request bodies such as JSON-like objects, strings, `FormData`, `URLSearchParams`, `Blob`, `ArrayBuffer`, and streams.
- Optional business wrapper validators and lifecycle hooks.

Outputs:

- Parsed response data by default.
- A response object with attached `data` and redacted `config` when `responseType: "response"` is used.
- `HttpRequestError` for all normalized request failures.

## Usage

Create a general client:

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

Use the same client factory for external services. Disable business wrapper
validation when the upstream response does not use the workspace wrapper:

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

Use the same factory for internal APIs. The default behavior treats
`{ success: false }` as an error:

```ts
import { createHttpClient } from "@shamt/oh-my-fetch";

const internalApi = createHttpClient({
  prefix: "/api",
});

const result = await internalApi.post("jobs", {
  type: "sync-products",
});
```

Handle custom business codes with `businessStatusValidator`:

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

Use `onErrorMessage` when application code needs to show UI feedback:

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

Use `hooks.beforeError` as the application-layer adapter entry when the app
needs to map `HttpRequestError` into another error model:

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

`businessStatusValidator` is the single extension point for growing business
code rules. It can return `true` to fail with the current response data, or
return a `BusinessFailureResult` to provide a custom status, message, code, and
data.

Pass query parameters through `query`:

```ts
const users = await api.get<User[]>("users", {
  query: {
    page: 1,
    pageSize: 20,
    roles: ["admin", "editor"],
  },
});
```

Validate request and response data with any supported schema shape:

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

Upload files with `FormData`; do not set `Content-Type` manually because Fetch must generate the multipart boundary:

```ts
const result = await api.upload("assets", {
  file,
  fieldName: "image",
  filename: "cover.png",
});
```

## Error Handling

All normalized failures are represented as `HttpRequestError`:

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

The `kind` field is stable and can be used by application-level adapters:

- `http_status`: upstream returned a non-2xx response.
- `timeout`: the request timed out.
- `network`: the request failed before receiving a response.
- `abort`: the request was canceled.
- `business`: the response wrapper was parsed as a business failure.
- `request_validation`: the request body failed schema validation.
- `response_validation`: the parsed response failed schema validation.
- `unknown`: a fallback for unexpected errors.

`HttpRequestError.config` is redacted before it is stored. Sensitive headers and query values such as authorization, cookie, token, password, and api key values are replaced with `[redacted]`.

## Runtime Notes

`@shamt/oh-my-fetch` is runtime-neutral for process-style and isolate-style runtimes as long as the runtime provides Fetch-compatible APIs. It can be used in Node, Cloudflare Workers, Vercel-like serverless environments, and browsers.

Some capabilities depend on the runtime:

- `Blob`, `FormData`, `ReadableStream`, and `AbortController` are detected through globals.
- Upload and download progress support follows `ky` and the underlying runtime.
- JSON parsing uses a safe default parser that drops `__proto__`, `constructor`, and `prototype` keys. Override `parseJson` only when an upstream API truly requires those fields.
