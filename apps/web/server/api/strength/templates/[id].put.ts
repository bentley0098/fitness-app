import { LogError } from "../../../utils/strengthLogs";
import { saveTemplate, type TemplateInput } from "../../../utils/strengthTemplates";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing template id" });
  const body = await readBody<TemplateInput>(event);

  try {
    return { id: await saveTemplate(id, body) };
  } catch (e) {
    if (e instanceof LogError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
