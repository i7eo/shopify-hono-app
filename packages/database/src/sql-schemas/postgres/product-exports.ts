import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { productExportParts, productExports } from "../../models/postgres";

export const insertProductExportSchema = createInsertSchema(productExports);
export const selectProductExportSchema = createSelectSchema(productExports);
export const insertProductExportPartSchema =
  createInsertSchema(productExportParts);
export const selectProductExportPartSchema =
  createSelectSchema(productExportParts);

export type InsertProductExport = typeof productExports.$inferInsert;
export type SelectProductExport = typeof productExports.$inferSelect;
export type InsertProductExportPart = typeof productExportParts.$inferInsert;
export type SelectProductExportPart = typeof productExportParts.$inferSelect;
