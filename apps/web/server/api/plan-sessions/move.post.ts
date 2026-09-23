import { PlanMoveError, moveSession } from "../../utils/planRevisions";
import { buildWeek, loadPlanSnapshot, raceInfo } from "../../utils/planView";

// Drag-and-drop on the Plan screen. Moves one planned session onto another day
// of the same ISO week, swapping with whatever already sits there.
//
// The week restriction is enforced here, not just in the UI: the client's
// drop targets are an affordance, never a guarantee.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ sessionId?: string; toDate?: string }>(event);

  if (!body.sessionId) throw createError({ statusCode: 400, statusMessage: "sessionId is required" });
  if (!body.toDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.toDate)) {
    throw createError({ statusCode: 400, statusMessage: "toDate must be a YYYY-MM-DD date" });
  }

  try {
    await moveSession(body.sessionId, body.toDate);
  } catch (e) {
    if (e instanceof PlanMoveError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }

  // Same shape as GET /api/plan-sessions?week=…, so the page can drop this
  // straight into its existing state instead of refetching. Re-read rather
  // than patched in memory, so completion badges and weekly totals come back
  // properly derived.
  const snapshot = await loadPlanSnapshot();
  return {
    race: raceInfo(snapshot.today),
    ...buildWeek(snapshot, body.toDate),
  };
});
