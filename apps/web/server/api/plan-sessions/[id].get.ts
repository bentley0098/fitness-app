import { buildPlannedSession, loadPlanSnapshot } from "../../utils/planView";
import { viewTemplate } from "../../utils/strengthStore";

// One planned session, for the activity page's planned view. Gym and physio
// sessions carry their template's exercises, read live.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing session id" });

  const session = buildPlannedSession(await loadPlanSnapshot(), id);
  if (!session) throw createError({ statusCode: 404, statusMessage: "Planned session not found" });

  const template = session.templateId ? await viewTemplate(session.templateId).catch(() => null) : null;
  return { ...session, template };
});
