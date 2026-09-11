import { addDaysIso, evaluateToday, loadTrainingWindow } from "../utils/trainingData";

export default defineEventHandler(async () => {
  const evaluation = await evaluateToday();
  const window = await loadTrainingWindow();

  const weekStart = addDaysIso(evaluation.asOfDate, -6);
  const weeklyVolumeM = window.activities
    .filter((a) => a.date >= weekStart && a.date <= evaluation.asOfDate)
    .reduce((sum, a) => sum + (a.distanceM ?? 0), 0);

  const todayMetrics = window.healthMetrics.find((m) => m.date === evaluation.asOfDate) ?? null;

  return {
    ...evaluation,
    weeklyVolumeM,
    todayMetrics,
  };
});
