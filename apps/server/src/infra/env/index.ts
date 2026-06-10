import { envConfigSchema } from "@shamt/app-env";
import { throwError } from "@shamt/utils";
import { formatZodError, isIsolateRuntime } from "@/utils";
import {
  parseIsolateConfig,
  type CloudflareIsolateConfig,
  type IsolateConfig,
  type VercelEdgeIsolateConfig,
} from "./isolate";
import { parseProcessConfig, type ProcessConfig } from "./process";
import { normalizeEnv } from "./shared";

const runtimeSchema = envConfigSchema.pick({
  APP_RUNTIME: true,
});

export type RuntimeConfig = ProcessConfig | IsolateConfig;
export type NodeRuntimeConfig = ProcessConfig;
export type CloudflareRuntimeConfig = CloudflareIsolateConfig;
export type VercelEdgeRuntimeConfig = VercelEdgeIsolateConfig;

/**
 * Parse and validate raw runtime environment input.
 * This is the public entry used by providers and bootstrap validation.
 */
export function getRuntimeConfig(rawEnv: unknown): RuntimeConfig {
  return parseRuntimeConfig(rawEnv);
}

/**
 * Normalize raw env, read APP_RUNTIME, and dispatch to isolate or process schema.
 */
export function parseRuntimeConfig(rawEnv: unknown): RuntimeConfig {
  const env = normalizeEnv(rawEnv);
  const runtimeResult = runtimeSchema.safeParse(env);
  if (!runtimeResult.success)
    throwError(
      `runtime parse env entry error`,
      formatZodError(runtimeResult.error),
    );

  if (isIsolateRuntime(runtimeResult.data.APP_RUNTIME)) {
    return parseIsolateConfig(env);
  }

  return parseProcessConfig(env);
}
