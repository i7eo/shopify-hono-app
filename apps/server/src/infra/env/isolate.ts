import { configSchema, DEFAULT_RUNTIMES } from "@shamt/app-env";
import { z } from "zod";
import { parseWithSchema } from "./shared";

export const cloudflareIsolateConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.CLOUDFLARE),
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
 * Cloudflare configs may include request-bound platform bindings.
 * Vercel Edge is intentionally separate so it can grow platform-specific bindings later.
 */
export function parseIsolateConfig(
  env: Record<string, unknown>,
): IsolateConfig {
  return parseWithSchema(isolateConfigSchema, env);
}
