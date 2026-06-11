import {
  appConfigSchema,
  cacheConfigSchema,
  dataBaseSchema,
  envConfigSchema,
  extendConfigSchema,
  logConfigSchema,
  redisSchema,
} from "@shamt/envs";
import { appEnvConfigSchema as $appConfigSchema } from "./app";
import type { z } from "zod";

export const configSchema = extendConfigSchema(
  appConfigSchema,
  $appConfigSchema,
)
  .extend(cacheConfigSchema.shape)
  .extend(dataBaseSchema.shape)
  .extend(envConfigSchema.shape)
  .extend(logConfigSchema.shape)
  .extend(redisSchema.shape);

export type ConfigSchema = z.infer<typeof configSchema>;
