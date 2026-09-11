export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const date = (query.date as string) ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await db.from("daily_notes").select("*").eq("date", date).maybeSingle();
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return data ?? { date, note: null, rpe: null };
});
