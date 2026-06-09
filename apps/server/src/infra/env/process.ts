import { DEFAULT_RUNTIMES } from "@shamt/envs";
import { z } from "zod";
import { configSchema } from "@/configs";
import { parseWithSchema } from "./shared";

export const processConfigSchema = configSchema.extend({
  APP_RUNTIME: z.literal(DEFAULT_RUNTIMES.NODE),
});

export type ProcessConfig = z.infer<typeof processConfigSchema>;

/**
 * Validate a process runtime config.
 * Process configs are expected to be available from process.env at bootstrap time.
 */
export function parseProcessConfig(
  env: Record<string, unknown>,
): ProcessConfig {
  return parseWithSchema(processConfigSchema, env);
}
