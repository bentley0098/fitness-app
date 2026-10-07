import { listTemplates } from "../../../utils/strengthStore";

export default defineEventHandler(async () => ({ templates: await listTemplates() }));
