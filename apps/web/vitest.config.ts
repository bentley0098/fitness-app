import { defineConfig } from "vitest/config";

// Scoped to the pure server utils. Everything under server/api and
// server/utils/db.ts needs live Supabase credentials (the client is
// constructed at module load), so those aren't unit-testable without a
// harness — the logic worth testing was extracted into pure modules instead.
export default defineConfig({
  test: {
    include: ["server/utils/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
