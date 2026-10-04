import { db } from "./db";
import { fetchRacePredictions } from "./garminMetrics";

export interface RacePredictionSyncResult {
  stored: boolean;
  errors: string[];
}

// Garmin only serves the current prediction, so history builds up one
// snapshot per day from here on. Upsert on date keeps repeat runs idempotent.
export async function syncRacePredictions(): Promise<RacePredictionSyncResult> {
  try {
    const row = await fetchRacePredictions();
    if (!row) return { stored: false, errors: [] };

    const { error } = await db.from("race_predictions").upsert(row, { onConflict: "date" });
    if (error) return { stored: false, errors: [`race predictions upsert failed — ${error.message}`] };
    return { stored: true, errors: [] };
  } catch (err) {
    return { stored: false, errors: [`race predictions failed — ${err instanceof Error ? err.message : String(err)}`] };
  }
}
