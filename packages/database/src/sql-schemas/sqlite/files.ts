import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sqliteFiles } from "../../models/sqlite";

export const insertSqliteFileSchema = createInsertSchema(sqliteFiles);
export const selectSqliteFileSchema = createSelectSchema(sqliteFiles);

export type InsertSqliteFile = typeof sqliteFiles.$inferInsert;
export type SelectSqliteFile = typeof sqliteFiles.$inferSelect;
