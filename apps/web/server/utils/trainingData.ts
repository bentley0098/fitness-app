import { evaluate } from "@fitness/engine";
import type { Activity, DailyHealthMetrics, EngineParams, EvaluationResult, TrainingWindow } from "@fitness/engine";
import { db } from "./db";

// Single source of truth for turning Supabase rows into the engine's types.
// Used by API routes (server/api/**) and the standalone scripts alike —
// don't duplicate this mapping.
export async function loadTrainingWindow(): Promise<TrainingWindow> {
  const [
    { data: activityRows, error: activityErr },
    { data: metricRows, error: metricErr },
    { data: paramRows, error: paramErr },
  ] = await Promise.all([
    db.from("activities").select("*").order("date", { ascending: true }),
    db.from("daily_health_metrics").select("*").order("date", { ascending: true }),
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

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export async function evaluateToday(): Promise<EvaluationResult & { asOfDate: string }> {
  const window = await loadTrainingWindow();
  const asOfDate = isoDate(new Date());
  return { asOfDate, ...evaluate(window, asOfDate) };
}
