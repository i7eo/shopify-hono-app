import { DEFAULT_RUNTIMES, envConfigSchema } from "@shamt/envs";
import { throwError } from "@shamt/utils";
import { z } from "zod";
import { formatZodError } from "@/utils";
import { configSchema } from "./$env";
import type { CloudflareKvCacheClient } from "@/types";

const runtimeSchema = envConfigSchema.pick({
  APP_RUNTIME: true,
});

export const nodeRuntimeConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.NODE),
});

export const cloudflareRuntimeConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.CLOUDFLARE),
  sofary: z.custom<CloudflareKvCacheClient>(
    (value) => {
      if (!value || typeof value !== "object") return false;
      const namespace = value as Partial<
        Record<keyof CloudflareKvCacheClient, unknown>
      >;
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

export type NodeRuntimeConfig = z.infer<typeof nodeRuntimeConfigSchema>;
export type CloudflareRuntimeConfig = z.infer<
  typeof cloudflareRuntimeConfigSchema
>;
export type RuntimeConfig = NodeRuntimeConfig | CloudflareRuntimeConfig;

export function getRuntimeConfig(rawEnv: unknown): RuntimeConfig {
  return parseRuntimeConfig(rawEnv);
}

export function parseRuntimeConfig(rawEnv: unknown): RuntimeConfig {
  const env = normalizeEnv(rawEnv);
  const runtimeResult = runtimeSchema.safeParse(env);
  if (!runtimeResult.success)
    throwError("apps/server", formatZodError(runtimeResult.error));

  if (runtimeResult.data.APP_RUNTIME === DEFAULT_RUNTIMES.CLOUDFLARE) {
    return parseWithSchema(cloudflareRuntimeConfigSchema, env);
  }
  return parseWithSchema(nodeRuntimeConfigSchema, env);
}

function parseWithSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  env: Record<string, unknown>,
): z.infer<TSchema> {
  const result = schema.safeParse(env);
  if (!result.success) throwError("apps/server", formatZodError(result.error));
  return result.data;
}

function normalizeEnv(rawEnv: unknown): Record<string, unknown> {
  if (!rawEnv || typeof rawEnv !== "object") return {};
  return Object.entries(rawEnv).reduce<Record<string, unknown>>(
    (envs, [key, value]) => {
      envs[key] = typeof value === "string" ? decodeURIComponent(value) : value;
      return envs;
    },
    {},
  );
}
