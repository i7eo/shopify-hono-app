import { z } from "zod";
import {
  DEFAULT_CACHE_EXPIRE,
  DEFAULT_CACHE_MAX_SIZE,
  DEFAULT_CACHE_REDIS_URL,
  DEFAULT_CACHE_TYPE,
  DEFAULT_CACHE_TYPES,
} from "../constants";

export const cacheConfigSchema = z.object({
  APP_CACHE_TYPE: z.enum(DEFAULT_CACHE_TYPES).default(DEFAULT_CACHE_TYPE),
  APP_CACHE_REDIS_URL: z.string().trim().default(DEFAULT_CACHE_REDIS_URL),
  APP_CACHE_EXPIRE: z.coerce.number().optional().default(DEFAULT_CACHE_EXPIRE),
  APP_CACHE_MAX_SIZE: z.coerce
    .number()
    .optional()
    .default(DEFAULT_CACHE_MAX_SIZE),
});

export type CacheConfigSchema = z.infer<typeof cacheConfigSchema>;
