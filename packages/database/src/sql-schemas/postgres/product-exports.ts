import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import {
  postgresProductExportParts,
  postgresProductExports,
} from "../../models/postgres";

export const insertPostgresProductExportSchema = createInsertSchema(
  postgresProductExports,
);
export const selectPostgresProductExportSchema = createSelectSchema(
  postgresProductExports,
);
export const insertPostgresProductExportPartSchema = createInsertSchema(
  postgresProductExportParts,
);
export const selectPostgresProductExportPartSchema = createSelectSchema(
  postgresProductExportParts,
);

export type InsertProductExport = typeof postgresProductExports.$inferInsert;
export type SelectProductExport = typeof postgresProductExports.$inferSelect;
export type InsertProductExportPart =
  typeof postgresProductExportParts.$inferInsert;
export type SelectProductExportPart =
  typeof postgresProductExportParts.$inferSelect;
