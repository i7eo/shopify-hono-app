import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { sqliteReferences } from "../../models/sqlite";
import type { z } from "zod";

export const insertSqliteReferenceSchema = createInsertSchema(sqliteReferences);
export const updateSqliteReferenceSchema = createUpdateSchema(sqliteReferences);
export const selectSqliteReferenceSchema = createSelectSchema(sqliteReferences);

export type InsertSqliteReference = z.infer<typeof insertSqliteReferenceSchema>;
export type UpdateSqliteReference = z.infer<typeof updateSqliteReferenceSchema>;
export type SelectSqliteReference = z.infer<typeof selectSqliteReferenceSchema>;
