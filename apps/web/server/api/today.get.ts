import { evaluate } from "@fitness/engine";
import { addDaysIso } from "../../shared/utils/calendar";
import { requestToday } from "../utils/requestZone";
import { loadTrainingWindow } from "../utils/trainingData";

// Kept alive for the standalone scripts and any existing consumer even though
// the Home screen now uses /api/dashboard.
export default defineEventHandler(async (event) => {
  // One load, not two: this previously called evaluateToday() (which loads the
  // window internally) and then loadTrainingWindow() again, fetching every
  // activity and health metric twice per request.
  const window = await loadTrainingWindow();
  const asOfDate = requestToday(event);
  const evaluation = evaluate(window, asOfDate);

  const weekStart = addDaysIso(asOfDate, -6);
  const weeklyVolumeM = window.activities
    .filter((a) => a.date >= weekStart && a.date <= asOfDate)
    .reduce((sum, a) => sum + (a.distanceM ?? 0), 0);

  const todayMetrics = window.healthMetrics.find((m) => m.date === asOfDate) ?? null;

  return {
    asOfDate,
    ...evaluation,
    weeklyVolumeM,
    todayMetrics,
  };
});
