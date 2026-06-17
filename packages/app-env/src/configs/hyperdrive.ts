import { z } from "zod";

export const hyperdriveConfigSchema = z.object({
  APP_HYPERDRIVER_BINDING: z.string().optional(),
  APP_HYPERDRIVER_ID: z.string().optional(),
});

export type HyperdriveConfigSchema = z.infer<typeof hyperdriveConfigSchema>;
