import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  sqliteProductExportParts,
  sqliteProductExports,
} from "../../models/sqlite";

export const insertSqliteProductExportSchema =
  createInsertSchema(sqliteProductExports);
export const selectSqliteProductExportSchema =
  createSelectSchema(sqliteProductExports);
export const insertSqliteProductExportPartSchema = createInsertSchema(
  sqliteProductExportParts,
);
export const selectSqliteProductExportPartSchema = createSelectSchema(
  sqliteProductExportParts,
);

export type InsertSqliteProductExport =
  typeof sqliteProductExports.$inferInsert;
export type SelectSqliteProductExport =
  typeof sqliteProductExports.$inferSelect;
export type InsertSqliteProductExportPart =
  typeof sqliteProductExportParts.$inferInsert;
export type SelectSqliteProductExportPart =
  typeof sqliteProductExportParts.$inferSelect;
