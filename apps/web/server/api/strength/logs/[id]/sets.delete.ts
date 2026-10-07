import { LogError, clearSet } from "../../../../utils/strengthLogs";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<{ logExerciseId?: string; setIndex?: number }>(event);
  if (!id || !body?.logExerciseId || typeof body.setIndex !== "number") {
    throw createError({ statusCode: 400, statusMessage: "logExerciseId and setIndex are required" });
  }

  try {
    await clearSet(id, body.logExerciseId, body.setIndex);
    return { ok: true };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
