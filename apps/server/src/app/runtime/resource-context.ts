import type { RuntimeConfig } from "@/infra/env";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

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
