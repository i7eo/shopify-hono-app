import { configSchema, DEFAULT_RUNTIMES } from "@shamt/app-env";
import { z } from "zod";
import { parseWithSchema } from "./shared";

export const cloudflareIsolateConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.CLOUDFLARE),
  // Platform bindings are optional at config parse time because Cloudflare
  // bootstrap can read process.env before request-bound env bindings exist.
  // Runtime capabilities must require the binding at the actual usage point.
  sofary: z
    .custom<KVNamespace>(
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
    )
    .optional(),
  i7eo_dev_shopify_app_r2: z
    .custom<R2Bucket>(
      (value) => {
        if (!value || typeof value !== "object") return false;
        const bucket = value as Partial<R2Bucket>;
        return (
          typeof bucket.get === "function" &&
          typeof bucket.put === "function" &&
          typeof bucket.delete === "function"
        );
      },
      {
        message: "Cloudflare R2 bucket binding with get/put/delete is required",
      },
    )
    .optional(),
  i7eo_dev_shopify_app_d1: z
    .custom<D1Database>(
      (value) => {
        if (!value || typeof value !== "object") return false;
        const database = value as Partial<D1Database>;
        return (
          typeof database.prepare === "function" &&
          typeof database.batch === "function" &&
          typeof database.exec === "function"
        );
      },
      {
        message: "Cloudflare D1 binding with prepare/batch/exec is required",
      },
    )
    .optional(),
  i7eo_dev_shopify_app_hyperdrive: z
    .custom<Hyperdrive>(
      (value) => {
        if (!value || typeof value !== "object") return false;
        const hyperdrive = value as Partial<Hyperdrive>;
        return typeof hyperdrive.connectionString === "string";
      },
      {
        message:
          "Cloudflare Hyperdrive binding with connectionString is required",
      },
    )
    .optional(),
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
 * Cloudflare configs may include request-bound bindings such as KV namespaces.
 * Vercel Edge is intentionally separate so it can grow platform-specific bindings later.
 */
export function parseIsolateConfig(
  env: Record<string, unknown>,
): IsolateConfig {
  return parseWithSchema(isolateConfigSchema, env);
}
