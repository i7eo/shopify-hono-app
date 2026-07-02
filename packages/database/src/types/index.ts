import type {
  postgresFiles,
  postgresProductExportParts,
  postgresProductExports,
  postgresReferences,
  postgresShopifySessions,
} from "../models/postgres";
import type {
  updatePostgresFileSchema,
  updatePostgresProductExportPartSchema,
  updatePostgresProductExportSchema,
  updatePostgresReferenceSchema,
  updatePostgresShopifySessionSchema,
} from "../schemas/postgres";
import type { z } from "zod";

export type InsertFile = typeof postgresFiles.$inferInsert;
export type UpdateFile = z.infer<typeof updatePostgresFileSchema>;
export type SelectFile = typeof postgresFiles.$inferSelect;

export type InsertProductExport = typeof postgresProductExports.$inferInsert;
export type UpdateProductExport = z.infer<
  typeof updatePostgresProductExportSchema
>;
export type SelectProductExport = typeof postgresProductExports.$inferSelect;

export type InsertProductExportPart =
  typeof postgresProductExportParts.$inferInsert;
export type UpdateProductExportPart = z.infer<
  typeof updatePostgresProductExportPartSchema
>;
export type SelectProductExportPart =
  typeof postgresProductExportParts.$inferSelect;

export type InsertReference = typeof postgresReferences.$inferInsert;
export type UpdateReference = z.infer<typeof updatePostgresReferenceSchema>;
export type SelectReference = typeof postgresReferences.$inferSelect;

export type InsertShopifySession = typeof postgresShopifySessions.$inferInsert;
export type UpdateShopifySession = z.infer<
  typeof updatePostgresShopifySessionSchema
>;
export type SelectShopifySession = typeof postgresShopifySessions.$inferSelect;
