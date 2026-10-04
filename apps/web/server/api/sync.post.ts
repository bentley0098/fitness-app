import { syncGarminActivities } from "../utils/syncGarmin";
import { syncHealthMetrics } from "../utils/syncHealthMetrics";
import { syncRacePredictions } from "../utils/syncRacePredictions";

// "Sync now" button on the Today screen. Same three steps as the daily cron,
// but a lighter window (recent activities, the last few days of wellness data)
// so it fits comfortably inside a serverless request.
//
// Like every other route in this app it has no user login, and it calls out to
// Garmin — so a cooldown stops a held-down button or a stray script from
// hammering the account. In-memory, hence per-instance: best effort, not a
// guarantee, which is enough for a single-user app.
const COOLDOWN_MS = 30_000;
const ACTIVITY_LIMIT = 10;
const HEALTH_DAYS = 3;

let lastRunAt = 0;

export default defineEventHandler(async () => {
  const waitMs = lastRunAt + COOLDOWN_MS - Date.now();
  if (waitMs > 0) {
    throw createError({
      statusCode: 429,
      statusMessage: `Synced a moment ago — try again in ${Math.ceil(waitMs / 1000)}s`,
    });
  }
  lastRunAt = Date.now();

  try {
    // Sequential, same reason as the cron: one SDK instance, one token refresh.
    const activities = await syncGarminActivities(ACTIVITY_LIMIT);
    const healthMetrics = await syncHealthMetrics(HEALTH_DAYS);
    const racePredictions = await syncRacePredictions();

    const errors = [...activities.errors, ...healthMetrics.errors, ...racePredictions.errors];
    return {
      syncedAt: new Date().toISOString(),
      newActivities: activities.inserted,
      healthDaysUpdated: healthMetrics.upserted,
      errors,
    };
  } catch (err) {
    // A failed run shouldn't lock the user out for the cooldown.
    lastRunAt = 0;
    throw createError({
      statusCode: 502,
      statusMessage: err instanceof Error ? err.message : "Garmin sync failed",
    });
  }
});
