import type { EngineParams } from "./types.js";

// Bounds any proposed weekly volume against the current week, regardless of
// what proposed it (LLM draft or otherwise) — spec Section 5: "model output
// is clamped by the engine after generation, always."
export function clampWeeklyIncrease(currentWeeklyVolumeM: number, proposedWeeklyVolumeM: number, params: EngineParams): number {
  const maxAllowed = currentWeeklyVolumeM * (1 + params.weeklyVolumeIncreaseCapPct / 100);
  return Math.min(proposedWeeklyVolumeM, maxAllowed);
}
