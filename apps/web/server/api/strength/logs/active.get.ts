import { activeLog } from "../../../utils/strengthLogs";

export default defineEventHandler(async () => ({ log: await activeLog() }));
