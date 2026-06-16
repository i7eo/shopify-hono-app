import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../models/users";

// Schema for updating/inserting a user (Frontend Form Validation)
export const insertUserSchema = createInsertSchema(users, {
  email: z.email("Invalid email address"),
}).omit({
  id: true,
  createdAt: true,
});

// Schema for data returned from the API
export const selectUserSchema = createSelectSchema(users);

// Export types for use in frontend hooks
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof selectUserSchema>;
