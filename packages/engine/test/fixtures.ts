import type { Activity, DailyHealthMetrics, EngineParams } from "../src/index.js";

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const defaultParams: EngineParams = {
  version: 1,
  workloadRatioSweetSpotMin: 0.8,
  workloadRatioSweetSpotMax: 1.3,
  workloadRatioDangerZone: 1.5,
  weeklyVolumeIncreaseCapPct: 10,
  consecutiveCleanWeeksToProgress: 2,
  consecutiveCleanWeeksToUnlockPhase: 3,
  restingHrSpikeThreshold: 5,
  bodyBatteryFloor: 25,
  reassessmentIntervalDays: 14,
};

// A steady baseline: constant daily volume (workload ratio ~1.0, dead center
// of the sweet spot) and unremarkable health metrics for every day in
// [asOfDate - daysBack, asOfDate]. Individual tests mutate specific days on
// top of this to carve out exactly the scenario they're testing.
export function buildBaseline(asOfDate: string, daysBack: number): { activities: Activity[]; healthMetrics: DailyHealthMetrics[] } {
  const activities: Activity[] = [];
  const healthMetrics: DailyHealthMetrics[] = [];

  for (let i = 0; i <= daysBack; i++) {
    const date = addDays(asOfDate, -i);
    activities.push({
      date,
      distanceM: 5000,
      movingTimeS: 1500,
      elapsedTimeS: 1500,
      avgHr: 140,
      maxHr: 155,
      cadence: 160,
      elevationM: 20,
      activityType: "running",
      externalId: `fixture-${date}`,
    });
    healthMetrics.push({
      date,
      hrvStatus: "balanced",
      hrvLastNightAvg: 50,
      hrvWeeklyAvg: 50,
      restingHr: 50,
      bodyBatteryMin: 60,
      bodyBatteryMax: 90,
      stressAvg: 20,
    });
  }

  return { activities, healthMetrics };
}

export function setHrvStatus(metrics: DailyHealthMetrics[], date: string, status: DailyHealthMetrics["hrvStatus"]): void {
  const day = metrics.find((m) => m.date === date);
  if (day) day.hrvStatus = status;
}

export function setRestingHr(metrics: DailyHealthMetrics[], date: string, value: number): void {
  const day = metrics.find((m) => m.date === date);
  if (day) day.restingHr = value;
}

export function setMovingTime(activities: Activity[], date: string, seconds: number): void {
  const day = activities.find((a) => a.date === date);
  if (day) day.movingTimeS = seconds;
}
