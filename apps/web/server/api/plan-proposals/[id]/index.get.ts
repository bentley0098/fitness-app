import { ProposalError, viewProposal } from "../../../utils/planProposals";
import { requestToday } from "../../../utils/requestZone";

export default defineEventHandler(async (event) => {
  try {
    return await viewProposal(getRouterParam(event, "id")!, requestToday(event));
  } catch (e) {
    if (e instanceof ProposalError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
