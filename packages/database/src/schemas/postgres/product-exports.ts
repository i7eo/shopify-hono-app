import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import {
  postgresProductExportParts,
  postgresProductExports,
} from "../../models/postgres";
import type { z } from "zod";

export const insertPostgresProductExportSchema = createInsertSchema(
  postgresProductExports,
);
export const updatePostgresProductExportSchema = createUpdateSchema(
  postgresProductExports,
);
export const selectPostgresProductExportSchema = createSelectSchema(
  postgresProductExports,
);
export const insertPostgresProductExportPartSchema = createInsertSchema(
  postgresProductExportParts,
);
export const updatePostgresProductExportPartSchema = createUpdateSchema(
  postgresProductExportParts,
);
export const selectPostgresProductExportPartSchema = createSelectSchema(
  postgresProductExportParts,
);

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
