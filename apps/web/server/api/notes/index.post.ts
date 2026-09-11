export default defineEventHandler(async (event) => {
  const body = await readBody<{ date?: string; note?: string | null; rpe?: number | null }>(event);
  const date = body.date ?? new Date().toISOString().slice(0, 10);

  if (body.rpe != null && (body.rpe < 1 || body.rpe > 10)) {
    throw createError({ statusCode: 400, statusMessage: "rpe must be between 1 and 10" });
  }

  const { data, error } = await db
    .from("daily_notes")
    .upsert({ date, note: body.note ?? null, rpe: body.rpe ?? null }, { onConflict: "date" })
    .select()
    .single();

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  return data;
});
