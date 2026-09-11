import { evaluate } from "@fitness/engine";
import { addDaysIso, isoDate, loadTrainingWindow } from "../utils/trainingData";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const days = Number(query.days ?? 42);

  const window = await loadTrainingWindow();
  const today = isoDate(new Date());

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysIso(today, -i);
    const weekStart = addDaysIso(date, -6);
    const weeklyVolumeM = window.activities
      .filter((a) => a.date >= weekStart && a.date <= date)
      .reduce((sum, a) => sum + (a.distanceM ?? 0), 0);

    const { verdict, signals } = evaluate(window, date);
    series.push({ date, weeklyVolumeM, workloadRatio: signals.workloadRatio, verdict });
  }

  return { series, engineParams: window.engineParams };
});
