import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { files } from "../models";

export const insertFileSchema = createInsertSchema(files);
export const selectFileSchema = createSelectSchema(files);

export type InsertFile = typeof files.$inferInsert;
export type SelectFile = typeof files.$inferSelect;
