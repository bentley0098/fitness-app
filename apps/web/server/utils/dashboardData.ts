import { computeWorkloadRatio, evaluate } from "@fitness/engine";
import { addDaysIso, isoDate } from "./dates";
import { db } from "./db";
import { loadTrainingWindow } from "./trainingData";
import { buildDay } from "./planCompletion";
import { mondayOf, weekDates, weekEndForStart, weekNumberFor } from "./planMeta";
import { raceInfo } from "./planView";
import { ACTIVITY_COLUMNS, HEALTH_METRIC_COLUMNS, toActivityDto, toHealthMetricsDto } from "./serialize";

// Everything the Home screen needs, in one request.
//
// Deliberately NOT shaped like /api/trends, which calls evaluate() once per
// day over a 42-day range. This is the most-visited screen; it evaluates once
// and derives the rest from the window already in memory.

const SPARKLINE_DAYS = 7;
const VOLUME_WEEKS = 8;
const RECENT_ACTIVITY_LIMIT = 5;
/** Matches computeWorkloadRatio's own floor for a meaningful reading. */
const MIN_HISTORY_DAYS = 14;

function sumDistance(activities: { date: string; distanceM?: number | null }[], from: string, to: string): number {
  return activities
    .filter((a) => a.date >= from && a.date <= to)
    .reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
}

function mean(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export async function buildDashboard() {
  const today = isoDate(new Date());
  const window = await loadTrainingWindow();
  const evaluation = evaluate(window, today);
  const load = computeWorkloadRatio(window.activities, today);

  const weekStart = mondayOf(today);
  const dates = weekDates(weekStart);

  // Three narrow queries alongside the window. The window's health metrics are
  // mapped to the ENGINE's type, which deliberately has no sleep fields — so
  // the raw rows are fetched separately for display.
  const [{ data: metricRows }, { data: planRows }, { data: recentRows }, { data: vo2Rows }] = await Promise.all([
    db
      .from("daily_health_metrics")
      .select(HEALTH_METRIC_COLUMNS)
      .gte("date", addDaysIso(today, -29))
      .lte("date", today)
      .order("date", { ascending: true }),
    db.from("plan_sessions").select("*").gte("date", weekStart).lte("date", addDaysIso(weekStart, 20)),
    db.from("activities").select(ACTIVITY_COLUMNS).order("date", { ascending: false }).limit(RECENT_ACTIVITY_LIMIT),
    db
      .from("activities")
      .select("date, vo2_max")
      .not("vo2_max", "is", null)
      .order("date", { ascending: false })
      .limit(40),
  ]);

  const metrics = (metricRows ?? []).map(toHealthMetricsDto);
  const sessions = planRows ?? [];
  const activityRows = window.activities;

  // ---- This week -------------------------------------------------------
  const days = dates.map((date) =>
    buildDay(
      date,
      (sessions.find((s) => s.date === date) as any) ?? null,
      activityRows as any,
      today,
    ),
  );
  const weekTotals = days.reduce(
    (acc, d) => {
      acc.plannedDistanceM += d.session?.targetDistanceM ?? 0;
      acc.actualDistanceM += d.completion.actualDistanceM;
      if (d.session) acc.sessionsPlanned++;
      if (d.completion.state === "completed") acc.sessionsCompleted++;
      return acc;
    },
    { plannedDistanceM: 0, actualDistanceM: 0, sessionsPlanned: 0, sessionsCompleted: 0 },
  );

  const todayDay = days.find((d) => d.date === today) ?? null;
  const nextSessionRow = sessions
    .filter((s) => s.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  // ---- Recovery --------------------------------------------------------
  const todayMetrics = metrics.find((m) => m.date === today) ?? metrics[metrics.length - 1] ?? null;

  // Resting HR against its own 28-day baseline. This is the delta the engine's
  // spike check uses, surfaced so the tile can show direction rather than a
  // bare number.
  const rhr28 = mean(metrics.map((m) => m.restingHr));
  const restingHrDelta28d =
    todayMetrics?.restingHr != null && rhr28 != null ? todayMetrics.restingHr - rhr28 : null;

  // ---- Fitness ---------------------------------------------------------
  const vo2Series = (vo2Rows ?? []).filter((r) => r.vo2_max != null);
  const currentVo2 = vo2Series[0] ?? null;
  const priorVo2 = currentVo2
    ? vo2Series.find((r) => r.date <= addDaysIso(currentVo2.date, -30)) ?? null
    : null;

  // ---- Series ----------------------------------------------------------
  const sparkDates = Array.from({ length: SPARKLINE_DAYS }, (_, i) => addDaysIso(today, -(SPARKLINE_DAYS - 1 - i)));
  const metricFor = (d: string) => metrics.find((m) => m.date === d) ?? null;

  const weeklyVolumeKm = Array.from({ length: VOLUME_WEEKS }, (_, i) => {
    const end = addDaysIso(weekStart, -(VOLUME_WEEKS - 1 - i) * 7 + 6);
    const start = addDaysIso(end, -6);
    return sumDistance(activityRows, start, end) / 1000;
  });

  return {
    asOfDate: today,
    verdict: evaluation.verdict,
    reason: evaluation.reason,
    signals: evaluation.signals,

    load: {
      ratio: Number.isFinite(load.ratio as number) ? load.ratio : null,
      // Infinity is a real outcome (no chronic load against a non-zero week);
      // flagged rather than serialised, since JSON has no Infinity.
      unbounded: load.ratio === Infinity,
      acuteS: load.acuteS,
      chronicAvgS: load.chronicAvgS,
      // Distinguishes "not enough history yet" from "ratio is genuinely zero",
      // so the tile can say so instead of showing a misleading number.
      insufficientHistory: load.ratio === null,
      historyDays: historyDays(activityRows, today),
      minHistoryDays: MIN_HISTORY_DAYS,
      sweetSpotMin: window.engineParams.workloadRatioSweetSpotMin,
      sweetSpotMax: window.engineParams.workloadRatioSweetSpotMax,
      dangerZone: window.engineParams.workloadRatioDangerZone,
    },

    week: {
      number: weekNumberFor(today),
      startDate: weekStart,
      endDate: weekEndForStart(weekStart),
      phase: days.find((d) => d.session)?.session?.phase ?? null,
      ...weekTotals,
    },

    today: {
      metrics: todayMetrics,
      restingHrDelta28d,
      session: todayDay?.session ?? null,
      completion: todayDay?.completion ?? null,
      activities: (todayDay?.activities ?? []).map((a) => toActivityDto(a as Record<string, any>)),
    },

    nextSession: nextSessionRow
      ? {
          date: nextSessionRow.date,
          phase: nextSessionRow.phase,
          type: nextSessionRow.type,
          prescription: nextSessionRow.prescription ?? {},
        }
      : null,

    vo2Max: {
      current: currentVo2?.vo2_max ?? null,
      date: currentVo2?.date ?? null,
      delta30d: currentVo2 && priorVo2 ? currentVo2.vo2_max - priorVo2.vo2_max : null,
    },

    race: raceInfo(today),

    sparklines: {
      restingHr: sparkDates.map((d) => metricFor(d)?.restingHr ?? null),
      sleepScore: sparkDates.map((d) => metricFor(d)?.sleep.score ?? null),
      bodyBattery: sparkDates.map((d) => metricFor(d)?.bodyBatteryMax ?? null),
      weeklyVolumeKm,
    },

    recentActivities: (recentRows ?? []).map(toActivityDto),
    lastActivityAt: activityRows.length ? activityRows[activityRows.length - 1]!.date : null,
  };
}

function historyDays(activities: { date: string }[], today: string): number {
  if (!activities.length) return 0;
  const earliest = activities.reduce((min, a) => (a.date < min ? a.date : min), activities[0]!.date);
  const ms = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${earliest}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}
