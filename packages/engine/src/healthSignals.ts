import type { DailyHealthMetrics, EngineParams } from "./types.js";

function metricsForDate(metrics: DailyHealthMetrics[], date: string): DailyHealthMetrics | undefined {
  return metrics.find((m) => m.date === date);
}

function lastNDates(asOfDate: string, n: number): string[] {
  const dates: string[] = [];
  const d = new Date(`${asOfDate}T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return dates;
}

// HRV red flag: unbalanced or low for 2+ consecutive days, ending on asOfDate.
// A single off day is noise; two in a row is the signal (spec Section 5).
export function hasHrvRedFlag(metrics: DailyHealthMetrics[], asOfDate: string): boolean {
  const [today, yesterday] = lastNDates(asOfDate, 2);
  const isFlagged = (date: string) => {
    const status = metricsForDate(metrics, date)?.hrvStatus;
    return status === "unbalanced" || status === "low";
  };
  return isFlagged(today) && isFlagged(yesterday);
}

// Resting-HR spike: 7-day rolling average vs. 28-day baseline. A sustained
// rise is a classic early illness/overreaching signal (spec Section 5).
export function hasRestingHrSpike(metrics: DailyHealthMetrics[], asOfDate: string, params: EngineParams): boolean {
  const recent7 = lastNDates(asOfDate, 7)
    .map((d) => metricsForDate(metrics, d)?.restingHr)
    .filter((v): v is number => v != null);
  const baseline28 = lastNDates(asOfDate, 28)
    .map((d) => metricsForDate(metrics, d)?.restingHr)
    .filter((v): v is number => v != null);

  if (recent7.length === 0 || baseline28.length === 0) return false; // insufficient data isn't a red flag on its own

  const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  return avg(recent7) - avg(baseline28) >= params.restingHrSpikeThreshold;
}

// Same-day caution only, per spec Section 5 — deliberately not folded into
// the weekly progression signals below.
export function hasLowBodyBattery(metrics: DailyHealthMetrics[], asOfDate: string, params: EngineParams): boolean {
  const today = metricsForDate(metrics, asOfDate);
  return today?.bodyBatteryMin != null && today.bodyBatteryMin < params.bodyBatteryFloor;
}
