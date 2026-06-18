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
import { bucketConfigSchema } from "./bucket";
import { cloudflareConfigSchema } from "./cloudflare";
import { databaseConfigSchema } from "./database";
import { hyperdriveConfigSchema } from "./hyperdrive";
import { queueConfigSchema } from "./queue";
import { schedulerConfigSchema } from "./scheduler";
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
  .extend(bucketConfigSchema.shape)
  .extend(cloudflareConfigSchema.shape)
  .extend(databaseConfigSchema.shape)
  .extend(hyperdriveConfigSchema.shape)
  .extend(queueConfigSchema.shape)
  .extend(schedulerConfigSchema.shape);

export type ConfigSchema = z.infer<typeof configSchema>;
