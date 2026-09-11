import { db } from "./db";
import { garmin } from "./garmin";

export interface HealthMetricsSyncResult {
  daysProcessed: number;
  upserted: number;
  errors: string[];
}

// Garmin's wellness endpoints have real fields beyond the SDK's strict Zod
// types (via .passthrough()) — accessed here through a loosely-typed view,
// same pattern as syncGarmin.ts.
type Raw = Record<string, any>;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function avgValidValues(pairs: [number, number | null][] | undefined): number | null {
  if (!pairs?.length) return null;
  // Garmin uses negative sentinels (-1, -2) for "no data" in stress/HR series.
  const valid = pairs.map(([, v]) => v).filter((v): v is number => v !== null && v >= 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function minMaxValues(pairs: [number, number | null][] | undefined): [number | null, number | null] {
  if (!pairs?.length) return [null, null];
  const valid = pairs.map(([, v]) => v).filter((v): v is number => v !== null);
  if (!valid.length) return [null, null];
  return [Math.min(...valid), Math.max(...valid)];
}

// Re-fetches and upserts the last `days` days every run (not just new ones) —
// unlike activities, Garmin's wellness data (especially HRV) can finalize or
// change hours after the day ends, so re-syncing recent history is the point.
export async function syncHealthMetrics(days = 7): Promise<HealthMetricsSyncResult> {
  const restored = await garmin.restoreSession();
  if (!restored) {
    throw new Error("No stored Garmin session — run the bootstrap login (npm run garmin:login) first.");
  }

  const result: HealthMetricsSyncResult = { daysProcessed: 0, upserted: 0, errors: [] };

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const day = isoDate(date);
    result.daysProcessed++;

    try {
      const [hrv, bodyBattery, heartRate, stress] = await Promise.all([
        garmin.health.getHrvStatus(date).catch(() => null),
        garmin.health.getBodyBattery(date).catch(() => null),
        garmin.health.getHeartRate(date).catch(() => null),
        garmin.health.getStress(date).catch(() => null),
      ]);

      const hrvRaw = hrv as Raw | null;
      const hrvSummary: Raw = hrvRaw?.hrvSummary ?? {};
      const bbRaw = (Array.isArray(bodyBattery) ? bodyBattery[0] : bodyBattery) as Raw | null;
      const hrRaw = heartRate as Raw | null;
      const stressRaw = stress as Raw | null;

      const [bbMin, bbMax] = minMaxValues(bbRaw?.bodyBatteryValuesArray);
      // Garmin's real field is avgStressLevel (top-level), not the
      // stressValues/stressValuesArray series the SDK's schema implies —
      // confirmed against a live payload. -1/-2 there means no data.
      const stressAvg: number | null =
        typeof stressRaw?.avgStressLevel === "number" && stressRaw.avgStressLevel >= 0
          ? stressRaw.avgStressLevel
          : null;
      const restingHr: number | null = hrRaw?.restingHeartRate ?? avgValidValues(hrRaw?.heartRateValues);

      const { error } = await db.from("daily_health_metrics").upsert(
        {
          date: day,
          hrv_status: (hrvSummary.status ?? "unknown").toString().toLowerCase(),
          hrv_last_night_avg: hrvSummary.lastNightAvg ?? null,
          hrv_weekly_avg: hrvSummary.weeklyAvg ?? null,
          resting_hr: restingHr,
          body_battery_min: bbMin,
          body_battery_max: bbMax,
          stress_avg: stressAvg,
          raw_payload: { hrv, bodyBattery, heartRate, stress },
        },
        { onConflict: "date" },
      );

      if (error) {
        result.errors.push(`${day}: upsert failed — ${error.message}`);
        continue;
      }
      result.upserted++;
    } catch (err) {
      result.errors.push(`${day}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
