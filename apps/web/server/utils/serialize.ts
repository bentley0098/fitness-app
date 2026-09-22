import { sessionLabel, targetDistanceM, targetDurationS } from "./planLabels";

// snake_case (Supabase) → camelCase (API output).
//
// Kept separate from loadTrainingWindow()'s mapping in trainingData.ts on
// purpose: that one maps to the ENGINE's types, a smaller shape that must not
// grow sleep or VO2 fields (the engine deliberately doesn't read them). This
// one is the HTTP boundary. Two mappings, two audiences — don't merge them.
//
// /api/plan-sessions used to leak raw snake_case (`changed_because`) while
// /api/today returned camelCase; everything goes through here now.

type Row = Record<string, any>;

export interface ActivityDto {
  id: string;
  externalId: string;
  date: string;
  activityType: string;
  distanceM: number | null;
  movingTimeS: number | null;
  elapsedTimeS: number | null;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  elevationM: number | null;
  vo2Max: number | null;
  trainingLoad: number | null;
  aerobicTe: number | null;
  anaerobicTe: number | null;
  avgPaceSPerKm: number | null;
}

/** Seconds per kilometre, or null when either side is missing or zero. */
export function paceSPerKm(distanceM: number | null, movingTimeS: number | null): number | null {
  if (!distanceM || !movingTimeS || distanceM <= 0 || movingTimeS <= 0) return null;
  return movingTimeS / (distanceM / 1000);
}

export function toActivityDto(r: Row): ActivityDto {
  return {
    id: r.id,
    externalId: r.external_id,
    date: r.date,
    activityType: r.activity_type,
    distanceM: r.distance_m ?? null,
    movingTimeS: r.moving_time_s ?? null,
    elapsedTimeS: r.elapsed_time_s ?? null,
    avgHr: r.avg_hr ?? null,
    maxHr: r.max_hr ?? null,
    cadence: r.cadence ?? null,
    elevationM: r.elevation_m ?? null,
    vo2Max: r.vo2_max ?? null,
    trainingLoad: r.training_load ?? null,
    aerobicTe: r.aerobic_te ?? null,
    anaerobicTe: r.anaerobic_te ?? null,
    avgPaceSPerKm: paceSPerKm(r.distance_m ?? null, r.moving_time_s ?? null),
  };
}

export interface PlanSessionDto {
  id: string;
  date: string;
  phase: string;
  type: string;
  prescription: Record<string, unknown>;
  cap: Record<string, unknown>;
  /** Engine-revision approval state: planned | pending | completed | skipped. */
  status: string;
  revision: number;
  changedBecause: string | null;
  label: string;
  targetDistanceM: number | null;
  targetDurationS: number | null;
}

export function toPlanSessionDto(r: Row): PlanSessionDto {
  const prescription = r.prescription ?? {};
  return {
    id: r.id,
    date: r.date,
    phase: r.phase,
    type: r.type,
    prescription,
    cap: r.cap ?? {},
    status: r.status ?? "planned",
    revision: r.revision ?? 1,
    changedBecause: r.changed_because ?? null,
    label: sessionLabel(r.type, prescription),
    targetDistanceM: targetDistanceM(prescription),
    targetDurationS: targetDurationS(prescription),
  };
}

export interface SleepDto {
  timeS: number | null;
  deepS: number | null;
  lightS: number | null;
  remS: number | null;
  awakeS: number | null;
  score: number | null;
  startLocal: string | null;
  endLocal: string | null;
}

export interface HealthMetricsDto {
  date: string;
  hrvStatus: string | null;
  hrvLastNightAvg: number | null;
  hrvWeeklyAvg: number | null;
  restingHr: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
  sleep: SleepDto;
}

export function toHealthMetricsDto(r: Row): HealthMetricsDto {
  return {
    date: r.date,
    hrvStatus: r.hrv_status ?? null,
    hrvLastNightAvg: r.hrv_last_night_avg ?? null,
    hrvWeeklyAvg: r.hrv_weekly_avg ?? null,
    restingHr: r.resting_hr ?? null,
    bodyBatteryMin: r.body_battery_min ?? null,
    bodyBatteryMax: r.body_battery_max ?? null,
    stressAvg: r.stress_avg ?? null,
    sleep: {
      timeS: r.sleep_time_s ?? null,
      deepS: r.deep_sleep_s ?? null,
      lightS: r.light_sleep_s ?? null,
      remS: r.rem_sleep_s ?? null,
      awakeS: r.awake_sleep_s ?? null,
      score: r.sleep_score ?? null,
      startLocal: r.sleep_start_local ?? null,
      endLocal: r.sleep_end_local ?? null,
    },
  };
}

/**
 * Explicit column lists. loadTrainingWindow() used `select("*")`, which pulls
 * raw_payload — the full Garmin blob, hundreds of KB per row — on every
 * request that touches the training window. Nothing downstream reads it.
 */
export const ACTIVITY_COLUMNS =
  "id, external_id, date, activity_type, distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, cadence, elevation_m, vo2_max, training_load, aerobic_te, anaerobic_te";

export const HEALTH_METRIC_COLUMNS =
  "id, date, hrv_status, hrv_last_night_avg, hrv_weekly_avg, resting_hr, body_battery_min, body_battery_max, stress_avg, sleep_time_s, deep_sleep_s, light_sleep_s, rem_sleep_s, awake_sleep_s, sleep_score, sleep_start_local, sleep_end_local";
