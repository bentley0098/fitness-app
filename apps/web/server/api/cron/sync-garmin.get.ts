import { syncGarminActivities } from "../../utils/syncGarmin";
import { syncHealthMetrics } from "../../utils/syncHealthMetrics";
import { syncRacePredictions } from "../../utils/syncRacePredictions";

// Vercel Cron attaches "Authorization: Bearer $CRON_SECRET" automatically to
// its own invocations when CRON_SECRET is set as an env var — this rejects
// anyone else hitting the (otherwise public) route URL directly.
export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, "authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Sequential, not Promise.all: both call garmin.restoreSession() on the
  // same SDK instance, and concurrent token-refresh attempts aren't something
  // our TokenStorage coordinates (no withRefreshLock implemented).
  const activities = await syncGarminActivities();
  const healthMetrics = await syncHealthMetrics();

  const racePredictions = await syncRacePredictions();

  return { activities, healthMetrics, racePredictions };
});
