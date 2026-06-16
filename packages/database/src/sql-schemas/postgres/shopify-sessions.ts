import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { postgresShopifySessions } from "../../models/postgres";

export const insertPostgresShopifySessionSchema = createInsertSchema(
  postgresShopifySessions,
);
export const selectPostgresShopifySessionSchema = createSelectSchema(
  postgresShopifySessions,
);

export type InsertPostgresShopifySession =
  typeof postgresShopifySessions.$inferInsert;
export type SelectPostgresShopifySession =
  typeof postgresShopifySessions.$inferSelect;
