import { z } from "zod";
import { DEFAULT_APP_DATABASE_PROVIDERS } from "./../constants/database";

export const dataBaseSchema = z.object({
  APP_DATABASE_PROVIDER: z.enum(DEFAULT_APP_DATABASE_PROVIDERS).optional(),
});

export type DataBaseSchema = z.infer<typeof dataBaseSchema>;
