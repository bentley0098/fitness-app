import { LogError, addSet } from "../../../../../../utils/strengthLogs";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const entryId = getRouterParam(event, "entryId");
  if (!id || !entryId) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  try {
    await addSet(id, entryId);
    return { ok: true };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
