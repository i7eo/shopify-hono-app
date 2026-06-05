import { getRuntimeConfig } from "./runtime";
import type { ConfigSchema } from "./$env";

let parsedEnv: ConfigSchema;

try {
  parsedEnv = getRuntimeConfig(process.env);
} catch (error) {
  console.error(`❌ ${(error as Error).message}`);
  process.exit(1);
}

export type Env = ConfigSchema;
export const env = parsedEnv;
