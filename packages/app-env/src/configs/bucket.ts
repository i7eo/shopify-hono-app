import { z } from "zod";
import { DEFAULT_APP_BUCKET_PROVIDERS } from "./../constants/bucket";

export const bucketSchema = z.object({
  APP_BUCKET_PROVIDER: z.enum(DEFAULT_APP_BUCKET_PROVIDERS).optional(),
  APP_BUCKET_R2_URL: z.url().optional(),
  APP_BUCKET_R2_KEY: z.string().optional(),
  APP_BUCKET_R2_VALUE: z.string().optional(),
});

export type BucketSchema = z.infer<typeof bucketSchema>;
