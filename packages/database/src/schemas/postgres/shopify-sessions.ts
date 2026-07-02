import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { postgresShopifySessions } from "../../models/postgres";
import type { z } from "zod";

export const insertPostgresShopifySessionSchema = createInsertSchema(
  postgresShopifySessions,
);
export const updatePostgresShopifySessionSchema = createUpdateSchema(
  postgresShopifySessions,
);
export const selectPostgresShopifySessionSchema = createSelectSchema(
  postgresShopifySessions,
);

export type InsertPostgresShopifySession = z.infer<
  typeof insertPostgresShopifySessionSchema
>;
export type UpdatePostgresShopifySession = z.infer<
  typeof updatePostgresShopifySessionSchema
>;
export type SelectPostgresShopifySession = z.infer<
  typeof selectPostgresShopifySessionSchema
>;
