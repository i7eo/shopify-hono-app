# @shamt/oh-my-fetch

<p><a href="./README.zh-CN.md">中文</a> | <strong>English</strong></p>

`@shamt/oh-my-fetch` is a general-purpose Fetch client built on top of `ky`.
It keeps the core small, safe, and runtime-neutral, then layers optional behavior
through explicit plugins.

## Design

- `client`: `HttpClient`, helper methods, plugin orchestration, scoped cleanup.
- `core`: body, query, headers, response parsing, and ky option conversion.
- `lifecycle`: disposable request scopes, abort signal composition, dedupe maps.
- `security`: safe JSON parsing and prototype-pollution sanitization.
- `plugins`: opt-in policies such as business status, request formatting, and error reporting.
- `errors`: `HttpRequestError`, redaction, and ky/fetch error normalization.
- `validation`: pluggable schema validation for request and response data.

The core does not know about application UI, business response wrappers, logging
providers, or framework-specific exceptions.

## Defaults

- JSON responses are parsed with `jsonSecurity: "strict"`.
- Business wrapper checks are not enabled by default.
- Request body trimming/date formatting is not enabled by default.
- Schema validation runs only when `bodySchema` or `responseSchema` is supplied.
- Dedupe is disabled unless `dedupe` is set.
- `HttpRequestError.toJSON()` omits raw response data and request body values.

## Basic Usage

```ts
import { createHttpClient } from "@shamt/oh-my-fetch";

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

## Query And Body

Use `query` for URL parameters and `body` for request payloads. The client picks
`json`, `body`, or urlencoded transport fields for ky.

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

Bodies are not mutated or normalized by default. Add the request-format plugin
when a service wants recursive string trimming and Date formatting.

```ts
import { createHttpClient, requestFormatPlugin } from "@shamt/oh-my-fetch";

const formattedApi = createHttpClient({
  plugins: [requestFormatPlugin()],
});
```

## Response Types

The default response type is `json`.

```ts
const text = await api.get<string>("health", {
  responseType: "text",
});

const response = await api.get<Response>("download", {
  responseType: "response",
});
```

When `responseType: "response"` is used, the returned `Response` has `data` and
a redacted `config` attached.

## Validation

Validation is built in but lazy. It runs only when schemas are supplied.
Adapters, Standard Schema, Zod-like `safeParse`, Yup-like `validate`, and
functions are supported.

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

Validation failures throw `HttpRequestError` with `kind` set to
`request_validation` or `response_validation`.

## Plugins

Plugins are explicit lifecycle policies.

```ts
import {
  businessStatusPlugin,
  createHttpClient,
  errorReporterPlugin,
  requestFormatPlugin,
} from "@shamt/oh-my-fetch";

const api = createHttpClient({
  plugins: [
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

`businessStatusPlugin()` treats common wrappers like `{ success: false }` or
`{ type: "error" }` as failures. A custom validator replaces the default.

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

Error reporting is a plugin, not a core callback.

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

## Dedupe And Disposal

Set `dedupe: true` to abort an older equivalent in-flight GET/HEAD request.
Use a string to dedupe any method by a custom key.

```ts
await api.get("users/current", { dedupe: true });
await api.post("search", body, { dedupe: "search:current" });
```

Dispose the client to abort pending dedupe-managed requests and release plugin
resources.

```ts
api.dispose();
```

## JSON Security

`jsonSecurity` controls prototype-pollution sanitization:

- `"strict"` recursively removes `__proto__`, `constructor`, and `prototype`.
- `"shallow"` removes those keys only at the top level.
- `"off"` leaves parsed JSON untouched.

```ts
const api = createHttpClient({
  defaults: {
    jsonSecurity: "strict",
  },
});
```

## Error Handling

All normalized failures use `HttpRequestError`.

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

Stable `kind` values:

- `http_status`
- `timeout`
- `network`
- `abort`
- `business`
- `request_validation`
- `response_validation`
- `unknown`

Request config stored on errors is redacted. Sensitive headers and query values
such as authorization, cookie, token, password, and API keys are replaced with
`[redacted]`; request bodies are never stored raw in `config`.

## Runtime Notes

The package works in runtimes with Fetch-compatible globals: browsers,
Cloudflare Workers, Node, and serverless isolates. `Blob`, `FormData`,
`ReadableStream`, `AbortController`, and upload/download progress support follow
the host runtime and ky behavior.
