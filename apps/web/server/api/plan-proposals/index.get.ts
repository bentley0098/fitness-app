import { listPendingProposals, listRecentProposals } from "../../utils/planProposals";

// `pending` feeds the banner; `recent` is the history of everything decided,
// superseded or expired, so those stay reachable.
export default defineEventHandler(async () => {
  const [pending, recent] = await Promise.all([listPendingProposals(), listRecentProposals()]);
  return { pending, recent };
});
