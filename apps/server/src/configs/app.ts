import { z } from "zod";

export const appConfigSchema = z.object({
  APP__SERVER_PORT: z.coerce.number(),
  APP__WEB_PORT: z.coerce.number(),
  SHOPIFY_APP_KEY: z.string().trim(),
  SHOPIFY_APP_SECRET: z.string().trim(),
  SHOPIFY_APP_URL: z.url(),
  SHOPIFY_API_VERSION: z.string().trim(),
  SCOPES: z.string().trim(),
});

export type AppConfigSchema = z.infer<typeof appConfigSchema>;
