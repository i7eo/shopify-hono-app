import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { sqliteFiles } from "../../models/sqlite";
import type { z } from "zod";

export const insertSqliteFileSchema = createInsertSchema(sqliteFiles);
export const updateSqliteFileSchema = createUpdateSchema(sqliteFiles);
export const selectSqliteFileSchema = createSelectSchema(sqliteFiles);

export type InsertSqliteFile = z.infer<typeof insertSqliteFileSchema>;
export type UpdateSqliteFile = z.infer<typeof updateSqliteFileSchema>;
export type SelectSqliteFile = z.infer<typeof selectSqliteFileSchema>;
