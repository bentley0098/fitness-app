import { hasHrvRedFlag, hasRestingHrSpike } from "./healthSignals.js";
import type { Activity, DailyHealthMetrics, EngineParams } from "./types.js";
import { computeWorkloadRatio } from "./workloadRatio.js";

// Precise definition of "clean week" (spec Section 10 open item, resolved
// here): as of weekEndDate, the workload ratio is known (enough history),
// sits at or below the danger zone, and neither the HRV nor resting-HR red
// flag is tripped. Below the sweet-spot floor still counts as clean —
// undertraining isn't an injury risk, it just won't itself justify
// progressing (see isSweetSpot below).
export function isCleanWeek(
  activities: Activity[],
  healthMetrics: DailyHealthMetrics[],
  params: EngineParams,
  weekEndDate: string,
): boolean {
  const { ratio } = computeWorkloadRatio(activities, weekEndDate);
  if (ratio === null) return false; // insufficient data never counts as clean
  if (ratio >= params.workloadRatioDangerZone) return false;
  if (hasHrvRedFlag(healthMetrics, weekEndDate)) return false;
  if (hasRestingHrSpike(healthMetrics, weekEndDate, params)) return false;
  return true;
}

export function isInSweetSpot(ratio: number | null, params: EngineParams): boolean {
  if (ratio === null) return false;
  return ratio >= params.workloadRatioSweetSpotMin && ratio <= params.workloadRatioSweetSpotMax;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Counts consecutive clean weeks ending on asOfDate, walking backward in
// 7-day steps, stopping at the first non-clean week (or after maxWeeks, a
// safety bound — nothing in engine_params should ever require checking
// further back than this).
export function countConsecutiveCleanWeeks(
  activities: Activity[],
  healthMetrics: DailyHealthMetrics[],
  params: EngineParams,
  asOfDate: string,
  maxWeeks = 12,
): number {
  let count = 0;
  let weekEnd = asOfDate;
  for (let i = 0; i < maxWeeks; i++) {
    if (!isCleanWeek(activities, healthMetrics, params, weekEnd)) break;
    count++;
    weekEnd = addDays(weekEnd, -7);
  }
  return count;
}
