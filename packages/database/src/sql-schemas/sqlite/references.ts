import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sqliteReferences } from "../../models/sqlite";

export const insertSqliteReferenceSchema = createInsertSchema(sqliteReferences);
export const selectSqliteReferenceSchema = createSelectSchema(sqliteReferences);

export type InsertSqliteReference = typeof sqliteReferences.$inferInsert;
export type SelectSqliteReference = typeof sqliteReferences.$inferSelect;
