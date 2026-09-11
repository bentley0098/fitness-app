export default defineEventHandler(async () => {
  const tables = [
    "activities",
    "daily_health_metrics",
    "daily_notes",
    "plan_sessions",
    "plan_revisions",
    "engine_params",
    "garmin_tokens",
  ] as const;

  const results = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
      return [table, error ? `error: ${error.message}` : count] as const;
    }),
  );

  return Object.fromEntries(results);
});
