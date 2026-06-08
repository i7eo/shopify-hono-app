import { DEFAULT_RUNTIMES } from "@shamt/envs";
import { z } from "zod";
import { configSchema } from "@/configs";
import { parseWithSchema } from "./shared";

export const cloudflareIsolateConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.CLOUDFLARE),
  sofary: z.custom<Env["sofary"]>(
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
export const vercelEdgeIsolateConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.VERCEL_EDGE),
});
export const isolateConfigSchema = z.discriminatedUnion("APP_RUNTIME", [
  cloudflareIsolateConfigSchema,
  // Reserved for future support. Vercel Edge currently has no runtime entry,
  // platform bindings, or Shopify session storage strategy in this app.
  vercelEdgeIsolateConfigSchema,
]);

export type IsolateConfig = z.infer<typeof isolateConfigSchema>;
export type CloudflareIsolateConfig = z.infer<
  typeof cloudflareIsolateConfigSchema
>;
export type VercelEdgeIsolateConfig = z.infer<
  typeof vercelEdgeIsolateConfigSchema
>;

/**
 * Validate an isolate runtime config and dispatch by isolate platform.
 * Cloudflare configs include request-bound bindings such as KV namespaces.
 * Vercel Edge is intentionally separate so it can grow platform-specific bindings later.
 */
export function parseIsolateConfig(
  env: Record<string, unknown>,
): IsolateConfig {
  return parseWithSchema(isolateConfigSchema, env);
}
