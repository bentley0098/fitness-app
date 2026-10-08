import { listPendingProposals, listRecentProposals } from "../../utils/planProposals";
import { requestToday } from "../../utils/requestZone";

// `pending` feeds the banner; `recent` is the history of everything decided,
// superseded or expired, so those stay reachable.
export default defineEventHandler(async (event) => {
  const today = requestToday(event);
  const [pending, recent] = await Promise.all([listPendingProposals(today), listRecentProposals(today)]);
  return { pending, recent };
});
