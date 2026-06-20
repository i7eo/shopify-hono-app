import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { postgresFiles } from "../../models/postgres";

export const insertPostgresFileSchema = createInsertSchema(postgresFiles);
export const selectPostgresFileSchema = createSelectSchema(postgresFiles);

export type InsertFile = typeof postgresFiles.$inferInsert;
export type SelectFile = typeof postgresFiles.$inferSelect;
