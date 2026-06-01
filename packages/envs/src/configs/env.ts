import { z } from "zod";
import { DEFAULT_ENV, DEFAULT_ENVS } from "../constants";

export const envConfigSchema = z.object({
  NODE_ENV: z.enum(DEFAULT_ENVS).default(DEFAULT_ENV),
});

export type EnvConfigSchema = z.infer<typeof envConfigSchema>;
