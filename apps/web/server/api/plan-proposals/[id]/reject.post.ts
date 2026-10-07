import { ProposalError, rejectProposal } from "../../../utils/planProposals";

export default defineEventHandler(async (event) => {
  try {
    await rejectProposal(getRouterParam(event, "id")!);
    return { ok: true };
  } catch (e) {
    if (e instanceof ProposalError) throw createError({ statusCode: e.statusCode, statusMessage: e.message });
    throw e;
  }
});
