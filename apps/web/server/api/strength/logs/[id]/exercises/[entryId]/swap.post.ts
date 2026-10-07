import { LogError, swapExercise, type ExerciseChoice } from "../../../../../../utils/strengthLogs";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const entryId = getRouterParam(event, "entryId");
  const body = await readBody<Partial<ExerciseChoice>>(event);
  if (!id || !entryId || !body?.name) throw createError({ statusCode: 400, statusMessage: "name is required" });

  try {
    await swapExercise(id, entryId, body as ExerciseChoice);
    return { ok: true };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
