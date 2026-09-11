import type { Activity } from "./types.js";

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function sumMovingTime(activities: Activity[], fromInclusive: string, toInclusive: string): number {
  return activities
    .filter((a) => a.date >= fromInclusive && a.date <= toInclusive)
    .reduce((total, a) => total + (a.movingTimeS ?? 0), 0);
}

export interface WorkloadRatioResult {
  ratio: number | null; // null when there isn't enough history for a meaningful reading
  acuteS: number;
  chronicAvgS: number;
}

// Acute:chronic workload ratio — acute = trailing 7-day total, chronic =
// trailing 28-day total ÷ 4 (i.e. its own weekly average). Standard
// sports-science heuristic; see spec Section 5.
//
// Returns ratio: null if there's under 14 days of activity history before
// asOfDate — a 28-day chronic average computed from a mostly-empty window is
// noise, not signal, and the engine should treat that as "insufficient data"
// rather than a false "clean" or "danger" reading.
export function computeWorkloadRatio(activities: Activity[], asOfDate: string): WorkloadRatioResult {
  const earliestActivityDate = activities.reduce<string | null>(
    (min, a) => (min === null || a.date < min ? a.date : min),
    null,
  );

  const acuteFrom = addDays(asOfDate, -6);
  const chronicFrom = addDays(asOfDate, -27);

  const acuteS = sumMovingTime(activities, acuteFrom, asOfDate);
  const chronicTotalS = sumMovingTime(activities, chronicFrom, asOfDate);
  const chronicAvgS = chronicTotalS / 4;

  const daysOfHistory =
    earliestActivityDate === null
      ? 0
      : Math.floor((new Date(`${asOfDate}T00:00:00Z`).getTime() - new Date(`${earliestActivityDate}T00:00:00Z`).getTime()) / 86_400_000) + 1;

  if (daysOfHistory < 14) {
    return { ratio: null, acuteS, chronicAvgS };
  }

  if (chronicAvgS === 0) {
    // Real history exists but zero training load in the chronic window —
    // any activity at all this week is an unbounded ratio increase, not a
    // meaningful multiple. Treat as danger-zone rather than divide-by-zero.
    return { ratio: acuteS > 0 ? Infinity : 0, acuteS, chronicAvgS };
  }

  return { ratio: acuteS / chronicAvgS, acuteS, chronicAvgS };
}
