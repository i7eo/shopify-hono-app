import { z } from "zod";

export const redisSchema = z.object({
  APP_CACHE_REDIS_URL: z.url().optional(),
});

export type ResidSchema = z.infer<typeof redisSchema>;
