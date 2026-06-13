import {
  appConfigSchema,
  cacheConfigSchema,
  dataBaseSchema,
  envConfigSchema,
  extendConfigSchema,
  fileConfigSchema,
  logConfigSchema,
  redisSchema,
} from "@shamt/envs";
import { appEnvConfigSchema as $appConfigSchema } from "./app";
import { dataBaseSchema as $dataBaseSchema } from "./database";
import type { z } from "zod";

export const configSchema = extendConfigSchema(
  appConfigSchema,
  $appConfigSchema,
)
  .extend(cacheConfigSchema.shape)
  .extend(dataBaseSchema.shape)
  .extend(envConfigSchema.shape)
  .extend(logConfigSchema.shape)
  .extend(redisSchema.shape)
  .extend(fileConfigSchema.shape)
  .extend($dataBaseSchema.shape);

export type ConfigSchema = z.infer<typeof configSchema>;
