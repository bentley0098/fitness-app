import { db } from "./db";
import { garmin } from "./garmin";
import { extractActivityMetrics } from "./garminActivityMetrics";

export interface GarminSyncResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

// Garmin's real activity payload has several fields (cadence, elevation,
// moving vs. elapsed duration) that exist at runtime via the SDK's Zod
// .passthrough() but aren't part of its strict types — accessed here through
// a loosely-typed view of the same object, not a separate fetch.
type RawDetail = Record<string, any>;

export async function syncGarminActivities(limit = 20): Promise<GarminSyncResult> {
  const restored = await garmin.restoreSession();
  if (!restored) {
    throw new Error("No stored Garmin session — run the bootstrap login (npm run garmin:login) first.");
  }

  const summaries = await garmin.activities.list({ limit });
  const result: GarminSyncResult = { fetched: summaries.length, inserted: 0, skipped: 0, errors: [] };

  for (const summary of summaries) {
    const externalId = String(summary.activityId);

    const { data: existing, error: existingError } = await db
      .from("activities")
      .select("id")
      .eq("external_id", externalId)
      .maybeSingle();

    if (existingError) {
      result.errors.push(`${externalId}: lookup failed — ${existingError.message}`);
      continue;
    }
    if (existing) {
      result.skipped++;
      continue;
    }

    try {
      const detail = (await garmin.activities.get(summary.activityId)) as RawDetail;
      const summaryDTO: RawDetail = detail.summaryDTO ?? {};

      const startTimeLocal: string | undefined = summaryDTO.startTimeLocal ?? summary.startTimeLocal;
      if (!startTimeLocal) {
        result.errors.push(`${externalId}: no startTimeLocal, skipped`);
        continue;
      }

      const { error: insertError } = await db.from("activities").insert({
        external_id: externalId,
        date: startTimeLocal.slice(0, 10),
        activity_type: detail.activityType?.typeKey ?? summary.activityType?.typeKey ?? "unknown",
        distance_m: summaryDTO.distance ?? summary.distance ?? null,
        moving_time_s: summaryDTO.movingDuration ?? summaryDTO.duration ?? summary.duration ?? null,
        elapsed_time_s: summaryDTO.elapsedDuration ?? summaryDTO.duration ?? summary.duration ?? null,
        avg_hr: summaryDTO.averageHR ?? null,
        max_hr: summaryDTO.maxHR ?? null,
        cadence: summaryDTO.averageRunningCadenceInStepsPerMinute ?? null,
        elevation_m: summaryDTO.elevationGain ?? null,
        // VO2 max and training load have no dedicated SDK endpoint — Garmin
        // only surfaces them inside the activity detail. Same extraction is
        // reused by scripts/backfill-activity-metrics.ts against stored
        // raw_payload, so it lives in one place.
        ...extractActivityMetrics(detail),
        raw_payload: detail,
      });

      if (insertError) {
        result.errors.push(`${externalId}: insert failed — ${insertError.message}`);
        continue;
      }
      result.inserted++;
    } catch (err) {
      result.errors.push(`${externalId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
