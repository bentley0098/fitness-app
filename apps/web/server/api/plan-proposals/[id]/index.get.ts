import { ProposalError, viewProposal } from "../../../utils/planProposals";

export default defineEventHandler(async (event) => {
  try {
    return await viewProposal(getRouterParam(event, "id")!);
  } catch (e) {
    if (e instanceof ProposalError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
