import { DEFAULT_RUNTIMES } from "@shamt/envs";
import { z } from "zod";
import { configSchema } from "@/configs";
import { parseWithSchema } from "./shared";
import type { CloudflareKvCacheStore } from "@/types";

export const isolateConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.CLOUDFLARE),
  sofary: z.custom<CloudflareKvCacheStore>(
    (value) => {
      if (!value || typeof value !== "object") return false;
      const namespace = value as Partial<KVNamespace>;
      return (
        typeof namespace.get === "function" &&
        typeof namespace.put === "function" &&
        typeof namespace.delete === "function" &&
        typeof namespace.list === "function"
      );
    },
    {
      message:
        "Cloudflare KV namespace binding with get/put/delete/list is required",
    },
  ),
});

export type IsolateConfig = z.infer<typeof isolateConfigSchema>;

/**
 * Validate an isolate runtime config.
 * Isolate configs include request-bound bindings such as Cloudflare KV namespaces.
 */
export function parseIsolateConfig(
  env: Record<string, unknown>,
): IsolateConfig {
  return parseWithSchema(isolateConfigSchema, env);
}
