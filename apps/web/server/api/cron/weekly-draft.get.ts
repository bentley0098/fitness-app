import { draftNextWeek } from "../../utils/weeklyDraft";

// Same CRON_SECRET bearer pattern as sync-garmin.
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  return await draftNextWeek();
});
