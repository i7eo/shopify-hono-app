import { getRuntimeConfig } from ".";
import type { ConfigSchema } from "@/configs";

/**
 * Process-only validated env singleton.
 * Use this only in code that runs outside isolate request-bound environments.
 */
let parsedEnv: ConfigSchema;

try {
  parsedEnv = getRuntimeConfig(process.env);
} catch (error) {
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
}

export type Env = ConfigSchema;
export const env = parsedEnv;
