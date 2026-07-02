import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { postgresReferences } from "../../models/postgres";
import type { z } from "zod";

export const insertPostgresReferenceSchema =
  createInsertSchema(postgresReferences);
export const updatePostgresReferenceSchema =
  createUpdateSchema(postgresReferences);
export const selectPostgresReferenceSchema =
  createSelectSchema(postgresReferences);

export type InsertPostgresReference = z.infer<
  typeof insertPostgresReferenceSchema
>;
export type UpdatePostgresReference = z.infer<
  typeof updatePostgresReferenceSchema
>;
export type SelectPostgresReference = z.infer<
  typeof selectPostgresReferenceSchema
>;
