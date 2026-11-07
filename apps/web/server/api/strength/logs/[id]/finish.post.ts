import { LogError, finishLog } from "../../../../utils/strengthLogs";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing session id" });

  // The body, when sent, is the whole session as logged on the device.
  const body = await readBody<unknown>(event).catch(() => null);

  try {
    await finishLog(id, body ?? undefined);
    return { ok: true };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
