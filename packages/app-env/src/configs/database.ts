import { z } from "zod";
import { DEFAULT_APP_DATABASE_PROVIDERS } from "./../constants/database";

export const appDatabaseConfigSchema = z.object({
  APP_DATABASE_PROVIDER: z.enum(DEFAULT_APP_DATABASE_PROVIDERS).optional(),
  APP_DATABASE_D1_URL: z.string().optional(),
  APP_DATABASE_D1_KEY: z.string().optional(),
  APP_DATABASE_D1_VALUE: z.string().optional(),
});

export type AppDatabaseConfigSchema = z.infer<typeof appDatabaseConfigSchema>;
