import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sqliteShopifySessions } from "../../models/sqlite";

export const insertSqliteShopifySessionSchema = createInsertSchema(
  sqliteShopifySessions,
);
export const selectSqliteShopifySessionSchema = createSelectSchema(
  sqliteShopifySessions,
);

export type InsertSqliteShopifySession =
  typeof sqliteShopifySessions.$inferInsert;
export type SelectSqliteShopifySession =
  typeof sqliteShopifySessions.$inferSelect;
