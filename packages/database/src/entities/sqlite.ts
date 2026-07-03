import type {
  insertSqliteFileSchema,
  insertSqliteProductExportPartSchema,
  insertSqliteProductExportSchema,
  insertSqliteReferenceSchema,
  insertSqliteShopifySessionSchema,
  selectSqliteFileSchema,
  selectSqliteProductExportPartSchema,
  selectSqliteProductExportSchema,
  selectSqliteReferenceSchema,
  selectSqliteShopifySessionSchema,
  updateSqliteFileSchema,
  updateSqliteProductExportPartSchema,
  updateSqliteProductExportSchema,
  updateSqliteReferenceSchema,
  updateSqliteShopifySessionSchema,
} from "../schemas/sqlite";
import type { z } from "zod";

export type InsertSqliteFile = z.infer<typeof insertSqliteFileSchema>;
export type UpdateSqliteFile = z.infer<typeof updateSqliteFileSchema>;
export type SelectSqliteFile = z.infer<typeof selectSqliteFileSchema>;

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

export type InsertSqliteReference = z.infer<typeof insertSqliteReferenceSchema>;
export type UpdateSqliteReference = z.infer<typeof updateSqliteReferenceSchema>;
export type SelectSqliteReference = z.infer<typeof selectSqliteReferenceSchema>;

export type InsertSqliteShopifySession = z.infer<
  typeof insertSqliteShopifySessionSchema
>;
export type UpdateSqliteShopifySession = z.infer<
  typeof updateSqliteShopifySessionSchema
>;
export type SelectSqliteShopifySession = z.infer<
  typeof selectSqliteShopifySessionSchema
>;
