# @shamt/envs

<p><a href="./README.zh-CN.md">中文</a> | <strong>English</strong></p>

## Table of Contents

- [Overview](#overview)
- [Design and Architecture](#design-and-architecture)
- [Inputs and Outputs](#inputs-and-outputs)
- [Usage](#usage)
- [Unit Conventions](#unit-conventions)

## Overview

`@shamt/envs` is the workspace package for shared environment constants and Zod configuration schemas. It centralizes reusable defaults, environment names, runtime names, HTTP status codes, response defaults, logger configuration, cache configuration, database configuration, Redis configuration, and related types.

This package does not read `process.env` and does not decide the current deployment platform. It only provides reusable constants, types, and schemas. Applications should parse actual raw env values in their own bootstrap flow, runtime env provider, or middleware.

## Design and Architecture

`@shamt/envs` keeps environment configuration boundaries explicit:

- `constants`: stable defaults and enum-like const objects, such as `DEFAULT_ENVS`, `DEFAULT_RUNTIMES`, `HTTP_STATUS_CODES`, and `RESPONSE_SUCCESS_CODE`.
- `configs`: Zod schemas for parseable environment variables, such as `appConfigSchema`, `envConfigSchema`, and `logConfigSchema`.
- `utils`: schema composition helpers, such as `extendConfigSchema`.

Schemas are responsible only for validation and defaults. They are not bound to Node, Cloudflare Workers, Vercel, or Bun. Each runtime can pass its own raw env object into a schema and receive a unified typed config.

The package intentionally uses const objects instead of TypeScript `enum`, so runtime values and TypeScript literal types stay aligned.

## Inputs and Outputs

Inputs:

- Environment-like objects, such as `process.env`, Cloudflare Worker bindings, or application-merged runtime config objects.
- Zod object schemas that need to be composed with shared schemas.

Outputs:

- Zod schemas for app, cache, database, env, logger, and Redis configuration.
- TypeScript inferred types such as `AppConfigSchema`, `EnvConfigSchema`, and `LogConfigSchema`.
- Shared constants for HTTP status codes, response defaults, content types, runtime names, env names, timeouts, and size limits.

## Usage

Parse standard runtime env fields:

```ts
import { envConfigSchema } from "@shamt/envs";

const config = envConfigSchema.parse({
  APP_ENV: "development",
  APP_RUNTIME: "cloudflare",
});

config.APP_ENV; // "development"
config.APP_RUNTIME; // "cloudflare"
```

Compose a project-specific config schema:

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

Use shared HTTP status and response defaults:

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

Use runtime constants instead of scattered string literals:

```ts
import { DEFAULT_RUNTIMES, type DEFAULT_RUNTIMES_VALUES } from "@shamt/envs";

function isCloudflare(runtime: DEFAULT_RUNTIMES_VALUES) {
  return runtime === DEFAULT_RUNTIMES.CLOUDFLARE;
}
```

## Unit Conventions

1. Time values are expressed in milliseconds by default.
2. File size and memory size values are expressed in bytes by default.
