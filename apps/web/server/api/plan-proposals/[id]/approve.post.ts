import { ProposalError, approveProposal } from "../../../utils/planProposals";
import { requestToday } from "../../../utils/requestZone";

// The only way a proposal becomes real. Deliberately not reachable from the MCP.
export default defineEventHandler(async (event) => {
  try {
    await approveProposal(getRouterParam(event, "id")!, requestToday(event));
    return { ok: true };
  } catch (e) {
    if (e instanceof ProposalError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
