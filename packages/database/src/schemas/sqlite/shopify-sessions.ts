import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { sqliteShopifySessions } from "../../models/sqlite";
import type { z } from "zod";

export const insertSqliteShopifySessionSchema = createInsertSchema(
  sqliteShopifySessions,
);
export const updateSqliteShopifySessionSchema = createUpdateSchema(
  sqliteShopifySessions,
);
export const selectSqliteShopifySessionSchema = createSelectSchema(
  sqliteShopifySessions,
);

export type InsertSqliteShopifySession = z.infer<
  typeof insertSqliteShopifySessionSchema
>;
export type UpdateSqliteShopifySession = z.infer<
  typeof updateSqliteShopifySessionSchema
>;
export type SelectSqliteShopifySession = z.infer<
  typeof selectSqliteShopifySessionSchema
>;
