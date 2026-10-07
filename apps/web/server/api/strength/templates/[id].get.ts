import { viewTemplate } from "../../../utils/strengthStore";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing template id" });

  const template = await viewTemplate(id);
  if (!template) throw createError({ statusCode: 404, statusMessage: "Template not found" });
  return template;
});
