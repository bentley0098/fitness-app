import { buildDashboard } from "../utils/dashboardData";
import { requestToday } from "../utils/requestZone";

export default defineEventHandler(async (event) => buildDashboard(requestToday(event)));
