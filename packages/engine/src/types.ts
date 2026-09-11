// Shapes mirror the tables in adaptive-training-plan-spec.md Section 4
// (rewritten in the 9 Sept 2026 pivot — Garmin recovery signals replace
// physio-supplied thresholds; the optional daily note is informational only
// and deliberately absent from TrainingWindow below, since the engine never
// reads it).

export type Verdict = "progress" | "hold" | "regress" | "stop";

export interface Activity {
  date: string; // ISO date
  distanceM: number;
  movingTimeS: number;
  elapsedTimeS: number;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  elevationM: number | null;
  activityType: string;
  externalId: string;
}

export type HrvStatusLabel = "balanced" | "unbalanced" | "low" | "unknown";

export interface DailyHealthMetrics {
  date: string; // ISO date
  hrvStatus: HrvStatusLabel;
  hrvLastNightAvg: number | null;
  hrvWeeklyAvg: number | null;
  restingHr: number | null;
  bodyBatteryMin: number | null;
  bodyBatteryMax: number | null;
  stressAvg: number | null;
}

export interface EngineParams {
  version: number;
  // Acute (7d) : chronic (28d/4) workload ratio bands.
  workloadRatioSweetSpotMin: number; // e.g. 0.8
  workloadRatioSweetSpotMax: number; // e.g. 1.3
  workloadRatioDangerZone: number; // e.g. 1.5 — at/above this, a red flag
  weeklyVolumeIncreaseCapPct: number; // e.g. 10 — the classic 10%-rule
  consecutiveCleanWeeksToProgress: number;
  consecutiveCleanWeeksToUnlockPhase: number;
  restingHrSpikeThreshold: number; // bpm above 28-day baseline
  bodyBatteryFloor: number; // below this overnight charge, same-day caution
  reassessmentIntervalDays: number;
}

export interface TrainingWindow {
  activities: Activity[];
  healthMetrics: DailyHealthMetrics[];
  engineParams: EngineParams;
}
