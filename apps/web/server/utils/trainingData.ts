import { evaluate } from "@fitness/engine";
import type { Activity, DailyHealthMetrics, EngineParams, EvaluationResult, TrainingWindow } from "@fitness/engine";
// isoDate/addDaysIso live in ./dates — pure, so callers that only need date
// arithmetic (planMeta and its tests) don't construct a Supabase client.
import { isoDate } from "./dates";
import { db } from "./db";
import { selectTolerant } from "./optionalColumns";
import {
  ACTIVITY_BASE_COLUMNS,
  ACTIVITY_COLUMNS,
  HEALTH_METRIC_BASE_COLUMNS,
  HEALTH_METRIC_COLUMNS,
} from "./serialize";

const ACTIVITY_TABLE = "activities";
const METRIC_TABLE = "daily_health_metrics";

// Single source of truth for turning Supabase rows into the engine's types.
// Used by API routes (server/api/**) and the standalone scripts alike —
// don't duplicate this mapping.
export async function loadTrainingWindow(): Promise<TrainingWindow> {
  const [
    { data: activityRows, error: activityErr },
    { data: metricRows, error: metricErr },
    { data: paramRows, error: paramErr },
  ] = await Promise.all([
    // Explicit columns, not select("*") — that pulled raw_payload, the full
    // Garmin blob for every row, on every request that touches the window.
    // Nothing downstream of here reads it. Wrapped so a database still on the
    // pre-0006 schema degrades instead of failing the request.
    selectTolerant(ACTIVITY_TABLE, ACTIVITY_COLUMNS, ACTIVITY_BASE_COLUMNS, (cols) =>
      db.from(ACTIVITY_TABLE).select(cols).order("date", { ascending: true }),
    ),
    selectTolerant(METRIC_TABLE, HEALTH_METRIC_COLUMNS, HEALTH_METRIC_BASE_COLUMNS, (cols) =>
      db.from(METRIC_TABLE).select(cols).order("date", { ascending: true }),
    ),
    db.from("engine_params").select("*").order("version", { ascending: false }).limit(1),
  ]);

  if (activityErr) throw new Error(`Load activities failed: ${activityErr.message}`);
  if (metricErr) throw new Error(`Load daily_health_metrics failed: ${metricErr.message}`);
  if (paramErr) throw new Error(`Load engine_params failed: ${paramErr.message}`);
  if (!paramRows?.length) throw new Error("No engine_params row — run `npm run engine:seed` first.");

  const activities: Activity[] = (activityRows ?? []).map((r) => ({
    date: r.date,
    distanceM: r.distance_m,
    movingTimeS: r.moving_time_s,
    elapsedTimeS: r.elapsed_time_s,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    cadence: r.cadence,
    elevationM: r.elevation_m,
    activityType: r.activity_type,
    externalId: r.external_id,
  }));

  const healthMetrics: DailyHealthMetrics[] = (metricRows ?? []).map((r) => ({
    date: r.date,
    hrvStatus: r.hrv_status ?? "unknown",
    hrvLastNightAvg: r.hrv_last_night_avg,
    hrvWeeklyAvg: r.hrv_weekly_avg,
    restingHr: r.resting_hr,
    bodyBatteryMin: r.body_battery_min,
    bodyBatteryMax: r.body_battery_max,
    stressAvg: r.stress_avg,
  }));

  const p = paramRows[0];
  const engineParams: EngineParams = {
    version: p.version,
    workloadRatioSweetSpotMin: p.workload_ratio_sweet_spot_min,
    workloadRatioSweetSpotMax: p.workload_ratio_sweet_spot_max,
    workloadRatioDangerZone: p.workload_ratio_danger_zone,
    weeklyVolumeIncreaseCapPct: p.weekly_volume_increase_cap_pct,
    consecutiveCleanWeeksToProgress: p.consecutive_clean_weeks_to_progress,
    consecutiveCleanWeeksToUnlockPhase: p.consecutive_clean_weeks_to_unlock_phase,
    restingHrSpikeThreshold: p.resting_hr_spike_threshold,
    bodyBatteryFloor: p.body_battery_floor,
    reassessmentIntervalDays: p.reassessment_interval_days,
  };

  return { activities, healthMetrics, engineParams };
}

export async function evaluateToday(): Promise<EvaluationResult & { asOfDate: string }> {
  const window = await loadTrainingWindow();
  const asOfDate = isoDate(new Date());
  return { asOfDate, ...evaluate(window, asOfDate) };
}
