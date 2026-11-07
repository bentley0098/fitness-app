import { listPendingProposals, listPendingViews, listRecentProposals } from "../../utils/planProposals";
import { requestToday } from "../../utils/requestZone";

// `pending` feeds the banner; `recent` is the history of everything decided,
// superseded or expired, so those stay reachable.
export default defineEventHandler(async (event) => {
  const today = requestToday(event);
  // ?detail=1 returns each pending proposal in full, for the review screen.
  const detailed = getQuery(event).detail === "1";
  const [pending, recent] = await Promise.all([detailed ? listPendingViews(today) : listPendingProposals(today), listRecentProposals(today)]);
  return { pending, recent };
});
