import { LogError } from "../../../utils/strengthLogs";
import { saveTemplate, type TemplateInput } from "../../../utils/strengthTemplates";

export default defineEventHandler(async (event) => {
  const body = await readBody<TemplateInput>(event);
  try {
    return { id: await saveTemplate(null, body) };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
