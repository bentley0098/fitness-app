import { localTimestamp, nonNegative } from "./garminValues";

// Maps a Garmin sleep payload to the daily_health_metrics sleep columns.
//
// Shared by syncHealthMetrics.ts (nightly, one day at a time via
// getDailySleep) and scripts/backfill-sleep.ts (historical, via
// getSleepRange), which return the same dailySleepDTO shape.
type Raw = Record<string, any>;

export interface SleepColumns {
  sleep_time_s: number | null;
  deep_sleep_s: number | null;
  light_sleep_s: number | null;
  rem_sleep_s: number | null;
  awake_sleep_s: number | null;
  sleep_score: number | null;
  sleep_start_local: string | null;
  sleep_end_local: string | null;
}

export const EMPTY_SLEEP: SleepColumns = {
  sleep_time_s: null,
  deep_sleep_s: null,
  light_sleep_s: null,
  rem_sleep_s: null,
  awake_sleep_s: null,
  sleep_score: null,
  sleep_start_local: null,
  sleep_end_local: null,
};

/**
 * `payload` is a getDailySleep response (or one entry of a getSleepRange
 * response). `expectedDay` is the ISO date being written.
 *
 * Garmin attributes a night to the day it ENDS on, and getDailySleep(date)
 * will happily hand back a neighbouring night when the requested day has no
 * data — so the calendarDate is checked before anything is written, rather
 * than silently filing one night's sleep under another day.
 */
export function extractSleep(payload: unknown, expectedDay: string): SleepColumns {
  const p = (payload ?? {}) as Raw;
  const dto: Raw = p.dailySleepDTO ?? p ?? {};

  const calendarDate: string | undefined = dto.calendarDate;
  if (calendarDate && calendarDate.slice(0, 10) !== expectedDay) return EMPTY_SLEEP;

  // sleepScores.overall.value is absent from the SDK's strict Zod type and
  // arrives only through .passthrough() — the same situation as
  // stress's avgStressLevel, which syncHealthMetrics.ts already documents.
  // Reading it off a loosely-typed view is intentional; don't "fix" it by
  // switching to the typed accessor, which doesn't have this field.
  const scores: Raw = dto.sleepScores ?? {};
  const overall: Raw = scores.overall ?? {};

  return {
    sleep_time_s: nonNegative(dto.sleepTimeSeconds),
    deep_sleep_s: nonNegative(dto.deepSleepSeconds),
    light_sleep_s: nonNegative(dto.lightSleepSeconds),
    rem_sleep_s: nonNegative(dto.remSleepSeconds),
    awake_sleep_s: nonNegative(dto.awakeSleepSeconds),
    sleep_score: nonNegative(overall.value ?? scores.overallScore),
    sleep_start_local: localTimestamp(dto.sleepStartTimestampLocal),
    sleep_end_local: localTimestamp(dto.sleepEndTimestampLocal),
  };
}

export function hasAnySleep(s: SleepColumns): boolean {
  return s.sleep_time_s != null || s.sleep_score != null;
}
