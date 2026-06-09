import { z } from "zod";

export const dataBaseSchema = z.object({
  APP_DATABASE_URL: z.url().optional(),
});

export type DataBaseSchema = z.infer<typeof dataBaseSchema>;
