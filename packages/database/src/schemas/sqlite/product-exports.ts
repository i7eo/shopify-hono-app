import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import {
  sqliteProductExportParts,
  sqliteProductExports,
} from "../../models/sqlite";
import type { z } from "zod";

export const insertSqliteProductExportSchema =
  createInsertSchema(sqliteProductExports);
export const updateSqliteProductExportSchema =
  createUpdateSchema(sqliteProductExports);
export const selectSqliteProductExportSchema =
  createSelectSchema(sqliteProductExports);
export const insertSqliteProductExportPartSchema = createInsertSchema(
  sqliteProductExportParts,
);
export const updateSqliteProductExportPartSchema = createUpdateSchema(
  sqliteProductExportParts,
);
export const selectSqliteProductExportPartSchema = createSelectSchema(
  sqliteProductExportParts,
);

export type InsertSqliteProductExport = z.infer<
  typeof insertSqliteProductExportSchema
>;
export type UpdateSqliteProductExport = z.infer<
  typeof updateSqliteProductExportSchema
>;
export type SelectSqliteProductExport = z.infer<
  typeof selectSqliteProductExportSchema
>;
export type InsertSqliteProductExportPart = z.infer<
  typeof insertSqliteProductExportPartSchema
>;
export type UpdateSqliteProductExportPart = z.infer<
  typeof updateSqliteProductExportPartSchema
>;
export type SelectSqliteProductExportPart = z.infer<
  typeof selectSqliteProductExportPartSchema
>;
