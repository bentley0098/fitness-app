export default defineEventHandler(async () => {
  const { data, error } = await db.from("plan_sessions").select("*").order("date", { ascending: true });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return data ?? [];
});
