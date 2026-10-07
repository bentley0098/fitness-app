import { listPendingProposals } from "../../utils/planProposals";

// Pending proposals for the banner. Expired ones are left out.
export default defineEventHandler(async () => ({ pending: await listPendingProposals() }));
