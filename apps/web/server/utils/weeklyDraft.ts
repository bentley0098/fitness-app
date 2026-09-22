import { evaluate } from "@fitness/engine";
import { proposeRevision } from "./planRevisions";
import { addDaysIso, isoDate } from "./dates";
import { loadTrainingWindow } from "./trainingData";

export interface WeeklyDraftResult {
  skipped: boolean;
  verdict: string;
  reason: string;
  planSessionId?: string;
  planRevisionId?: string;
  requestedWeeklyVolumeM?: number;
  clampedWeeklyVolumeM?: number;
}

// Fully deterministic — no LLM in this path, deliberately. This is the
// automated Sunday-evening draft (spec Section 6); the MCP tools below are
// for a richer, on-demand, chat-driven proposal when asked, still clamped by
// the same engine either way.
export async function draftNextWeek(): Promise<WeeklyDraftResult> {
  const window = await loadTrainingWindow();
  const asOfDate = isoDate(new Date());
  const evaluation = evaluate(window, asOfDate);

  if (evaluation.verdict === "stop") {
    // Don't draft anything to approve — there's nothing to approve into.
    return { skipped: true, verdict: evaluation.verdict, reason: evaluation.reason };
  }

  const weekStart = addDaysIso(asOfDate, -6);
  const currentWeeklyVolumeM = window.activities
    .filter((a) => a.date >= weekStart && a.date <= asOfDate)
    .reduce((sum, a) => sum + (a.distanceM ?? 0), 0);

  const targetWeeklyVolumeM =
    evaluation.verdict === "progress"
      ? currentWeeklyVolumeM * (1 + window.engineParams.weeklyVolumeIncreaseCapPct / 100)
      : evaluation.verdict === "regress"
        ? currentWeeklyVolumeM * 0.8
        : currentWeeklyVolumeM; // hold

  const result = await proposeRevision({
    date: addDaysIso(asOfDate, 1),
    phase: "auto", // no phase concept wired yet — Section 5's phase-unlock isn't read anywhere until this exists downstream
    type: "weekly-target",
    targetWeeklyVolumeM,
    rationale: evaluation.reason,
  });

  return {
    skipped: false,
    verdict: result.verdict,
    reason: evaluation.reason,
    planSessionId: result.planSessionId,
    planRevisionId: result.planRevisionId,
    requestedWeeklyVolumeM: result.requestedWeeklyVolumeM,
    clampedWeeklyVolumeM: result.clampedWeeklyVolumeM,
  };
}
