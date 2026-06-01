// import { appConfigSchema } from "./app";
// import { cacheConfigSchema } from "./cache";
// import { dataBaseSchema } from "./database";
// import { logConfigSchema } from "./log";
// import type { z } from "zod";

// export const configSchema = appConfigSchema
//   .extend(cacheConfigSchema.shape)
//   .extend(dataBaseSchema.shape)
//   .extend(logConfigSchema.shape);

// export type ConfigSchema = z.infer<typeof configSchema>;

export * from "./app";
export * from "./cache";
export * from "./database";
export * from "./env";
export * from "./log";
