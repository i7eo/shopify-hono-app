import type { RuntimeConfig } from "@/infra/env";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Framework-agnostic input accepted by runtime resource factories
 * (database/bucket/queue/etc.). Keeping it minimal decouples those factories
 * from Hono so background jobs can call them with `{ bindings, runtimeEnv }`.
 */
export type RuntimeResourceContext = {
  bindings?: Record<string, unknown>;
  runtimeEnv: RuntimeConfig;
};

/**
 * Converts a Hono request context into the minimal input needed by runtime
 * resource factories.
 */
export function createRuntimeResourceContextFromHono(
  c: Context<AppEnv>,
): RuntimeResourceContext {
  return {
    bindings: c.env as Record<string, unknown>,
    runtimeEnv: c.get("runtimeEnv"),
  };
}
