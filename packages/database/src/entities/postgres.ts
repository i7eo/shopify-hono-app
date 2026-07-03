import type {
  insertPostgresFileSchema,
  insertPostgresProductExportPartSchema,
  insertPostgresProductExportSchema,
  insertPostgresReferenceSchema,
  insertPostgresShopifySessionSchema,
  selectPostgresFileSchema,
  selectPostgresProductExportPartSchema,
  selectPostgresProductExportSchema,
  selectPostgresReferenceSchema,
  selectPostgresShopifySessionSchema,
  updatePostgresFileSchema,
  updatePostgresProductExportPartSchema,
  updatePostgresProductExportSchema,
  updatePostgresReferenceSchema,
  updatePostgresShopifySessionSchema,
} from "../schemas/postgres";
import type { z } from "zod";

export type InsertPostgresFile = z.infer<typeof insertPostgresFileSchema>;
export type UpdatePostgresFile = z.infer<typeof updatePostgresFileSchema>;
export type SelectPostgresFile = z.infer<typeof selectPostgresFileSchema>;

export type InsertPostgresProductExport = z.infer<
  typeof insertPostgresProductExportSchema
>;
export type UpdatePostgresProductExport = z.infer<
  typeof updatePostgresProductExportSchema
>;
export type SelectPostgresProductExport = z.infer<
  typeof selectPostgresProductExportSchema
>;
export type InsertPostgresProductExportPart = z.infer<
  typeof insertPostgresProductExportPartSchema
>;
export type UpdatePostgresProductExportPart = z.infer<
  typeof updatePostgresProductExportPartSchema
>;
export type SelectPostgresProductExportPart = z.infer<
  typeof selectPostgresProductExportPartSchema
>;

export type InsertPostgresReference = z.infer<
  typeof insertPostgresReferenceSchema
>;
export type UpdatePostgresReference = z.infer<
  typeof updatePostgresReferenceSchema
>;
export type SelectPostgresReference = z.infer<
  typeof selectPostgresReferenceSchema
>;

export type InsertPostgresShopifySession = z.infer<
  typeof insertPostgresShopifySessionSchema
>;
export type UpdatePostgresShopifySession = z.infer<
  typeof updatePostgresShopifySessionSchema
>;
export type SelectPostgresShopifySession = z.infer<
  typeof selectPostgresShopifySessionSchema
>;
