import { LogError, startLog } from "../../../utils/strengthLogs";
import { requestToday } from "../../../utils/requestZone";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ templateId?: string; planSessionId?: string | null; date?: string }>(event);
  if (!body?.templateId) throw createError({ statusCode: 400, statusMessage: "templateId is required" });
  if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw createError({ statusCode: 400, statusMessage: "date must be a YYYY-MM-DD date" });
  }

  try {
    return { id: await startLog({ templateId: body.templateId, planSessionId: body.planSessionId, date: body.date ?? requestToday(event) }) };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
