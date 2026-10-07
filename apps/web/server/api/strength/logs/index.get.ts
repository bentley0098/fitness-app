import { listLogs } from "../../../utils/strengthLogs";

export default defineEventHandler(async () => ({ logs: await listLogs() }));
