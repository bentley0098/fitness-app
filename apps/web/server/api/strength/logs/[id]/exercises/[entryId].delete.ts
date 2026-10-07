import { LogError, removeLogExercise } from "../../../../../utils/strengthLogs";

// Skips an exercise: removes it from this session only.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const entryId = getRouterParam(event, "entryId");
  if (!id || !entryId) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  try {
    await removeLogExercise(id, entryId);
    return { ok: true };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
