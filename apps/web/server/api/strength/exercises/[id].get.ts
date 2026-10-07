import { LogError, loadExerciseHistory } from "../../../utils/strengthLogs";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing exercise id" });

  try {
    return await loadExerciseHistory(id);
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
