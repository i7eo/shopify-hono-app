import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { postgresReferences } from "../../models/postgres";

export const insertPostgresReferenceSchema =
  createInsertSchema(postgresReferences);
export const selectPostgresReferenceSchema =
  createSelectSchema(postgresReferences);

export type InsertReference = typeof postgresReferences.$inferInsert;
export type SelectReference = typeof postgresReferences.$inferSelect;
