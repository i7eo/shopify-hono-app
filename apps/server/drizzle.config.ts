import { defineConfig } from "drizzle-kit";

const url = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  ...(url ? { dbCredentials: { url } } : {}),
  dialect: "postgresql",
  out: "./drizzle",
  schema: "../../packages/database/src/models/index.ts",
});
