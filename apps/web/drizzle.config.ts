import { defineConfig } from "drizzle-kit";

// drizzle-kit is used here only to author the schema and diff it into SQL
// migration files ("npm run db:generate"). Nothing connects to the database
// with this config — the generated SQL is applied by pasting it into the
// Supabase SQL Editor, and the app itself talks to Supabase via
// @supabase/supabase-js (server/utils/db.ts), not a direct Postgres connection.
export default defineConfig({
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dialect: "postgresql",
});
