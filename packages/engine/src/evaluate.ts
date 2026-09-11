import { countConsecutiveCleanWeeks, isInSweetSpot } from "./cleanWeek.js";
import { hasHrvRedFlag, hasLowBodyBattery, hasRestingHrSpike } from "./healthSignals.js";
import { isInItalyDeload } from "./italyDeload.js";
import type { TrainingWindow, Verdict } from "./types.js";
import { computeWorkloadRatio } from "./workloadRatio.js";

export interface EvaluationSignals {
  workloadRatio: number | null;
  hrvRedFlag: boolean;
  restingHrSpike: boolean;
  lowBodyBatteryToday: boolean; // same-day caution only; never changes the verdict below
  inItalyDeload: boolean;
  consecutiveCleanWeeks: number;
}

export interface EvaluationResult {
  verdict: Verdict;
  reason: string;
  signals: EvaluationSignals;
}

export function evaluate(window: TrainingWindow, asOfDate: string): EvaluationResult {
  const { activities, healthMetrics, engineParams: params } = window;

  const { ratio } = computeWorkloadRatio(activities, asOfDate);
  const hrvRedFlag = hasHrvRedFlag(healthMetrics, asOfDate);
  const restingHrSpike = hasRestingHrSpike(healthMetrics, asOfDate, params);
  const lowBodyBatteryToday = hasLowBodyBattery(healthMetrics, asOfDate, params);
  const inItalyDeload = isInItalyDeload(asOfDate);
  const inDangerZone = ratio !== null && ratio >= params.workloadRatioDangerZone;

  const signals: EvaluationSignals = {
    workloadRatio: ratio,
    hrvRedFlag,
    restingHrSpike,
    lowBodyBatteryToday,
    inItalyDeload,
    consecutiveCleanWeeks: countConsecutiveCleanWeeks(activities, healthMetrics, params, asOfDate),
  };

  // Multi-signal stop: all three at once, deliberately — a single noisy
  // metric shouldn't trip this (spec Section 5). Checked before the Italy
  // deload branch: travel doesn't excuse an active red flag.
  if (inDangerZone && hrvRedFlag && restingHrSpike) {
    return {
      verdict: "stop",
      reason: `Workload ratio in the danger zone (${ratio?.toFixed(2)}), HRV flagged unbalanced/low for 2+ days, and resting HR is elevated vs. baseline — all at once. Consider medical advice before the next session.`,
      signals,
    };
  }

  if (inItalyDeload) {
    return {
      verdict: "hold",
      reason: "Italy trip deload window (17–29 Sept 2026) — no progression regardless of other signals, and no make-up volume afterward.",
      signals,
    };
  }

  if (ratio === null) {
    return {
      verdict: "hold",
      reason: "Fewer than 14 days of activity history — not enough to compute a reliable workload ratio yet.",
      signals,
    };
  }

  if (inDangerZone) {
    return {
      verdict: "regress",
      reason: `Workload ratio (${ratio.toFixed(2)}) is at or above the danger-zone threshold (${params.workloadRatioDangerZone}) — cutting volume back regardless of how it feels.`,
      signals,
    };
  }

  if (hrvRedFlag || restingHrSpike) {
    const which = [hrvRedFlag && "HRV unbalanced/low 2+ days", restingHrSpike && "resting HR elevated vs. 28-day baseline"]
      .filter(Boolean)
      .join(" and ");
    return { verdict: "hold", reason: `${which} — holding at current volume until this clears.`, signals };
  }

  if (signals.consecutiveCleanWeeks >= params.consecutiveCleanWeeksToProgress && isInSweetSpot(ratio, params)) {
    return {
      verdict: "progress",
      reason: `${signals.consecutiveCleanWeeks} consecutive clean weeks with workload ratio in the sweet spot (${ratio.toFixed(2)}) — clear to increase.`,
      signals,
    };
  }

  if (signals.consecutiveCleanWeeks < params.consecutiveCleanWeeksToProgress) {
    return {
      verdict: "hold",
      reason: `Clean, but only ${signals.consecutiveCleanWeeks}/${params.consecutiveCleanWeeksToProgress} consecutive clean weeks so far — holding until the streak is long enough to progress.`,
      signals,
    };
  }

  // Clean weeks satisfied, but ratio is outside the sweet spot — either
  // undertraining (below the floor, safe but not a basis to add volume) or
  // sitting just under the danger zone. Either way, hold rather than
  // progress off a ratio that isn't actually in the target band.
  return {
    verdict: "hold",
    reason: `${signals.consecutiveCleanWeeks} consecutive clean weeks, but workload ratio (${ratio.toFixed(2)}) is outside the sweet spot (${params.workloadRatioSweetSpotMin}–${params.workloadRatioSweetSpotMax}) — holding rather than progressing off that.`,
    signals,
  };
}
