import { computeWorkloadRatio, evaluate } from "@fitness/engine";
import { addDaysIso, isoDate } from "./dates";
import { db } from "./db";
import { loadTrainingWindow } from "./trainingData";
import { buildDay, sessionsByDate, totalsFor } from "./planCompletion";
import { mondayOf, weekDates, weekEndForStart, weekNumberFor } from "./planMeta";
import { raceInfo } from "./planView";
import { selectTolerant } from "./optionalColumns";
import {
  ACTIVITY_BASE_COLUMNS,
  ACTIVITY_COLUMNS,
  HEALTH_METRIC_BASE_COLUMNS,
  HEALTH_METRIC_COLUMNS,
  toActivityDto,
  toHealthMetricsDto,
} from "./serialize";

// Everything the Home screen needs, in one request.
//
// Deliberately NOT shaped like /api/trends, which calls evaluate() once per
// day over a 42-day range. This is the most-visited screen; it evaluates once
// and derives the rest from the window already in memory.

const SPARKLINE_DAYS = 7;
const VOLUME_WEEKS = 12;
const RECENT_ACTIVITY_LIMIT = 5;
/** Matches computeWorkloadRatio's own floor for a meaningful reading. */
const MIN_HISTORY_DAYS = 14;

function mean(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

/**
 * VO2 max history, newest first. Prefers the daily metric (Garmin's max-metrics
 * endpoint), which carries a value for every recompute day; falls back to the
 * per-activity column for history from before that sync existed. Both select on
 * post-migration columns, so if neither exists the honest answer is "no data",
 * not an error.
 */
async function loadVo2Series(): Promise<{ date: string; vo2_max: number }[]> {
  const daily = await db
    .from("daily_health_metrics")
    .select("date, vo2_max")
    .not("vo2_max", "is", null)
    .order("date", { ascending: false })
    .limit(60);
  if (!daily.error && daily.data?.length) return daily.data as { date: string; vo2_max: number }[];

  const { data, error } = await db
    .from("activities")
    .select("date, vo2_max")
    .not("vo2_max", "is", null)
    .order("date", { ascending: false })
    .limit(40);

  if (error) return [];
  return (data ?? []) as { date: string; vo2_max: number }[];
}

interface RacePredictionRow {
  date: string;
  time_5k_s: number | null;
  time_10k_s: number | null;
  time_half_s: number | null;
  time_marathon_s: number | null;
}

/** Newest first. Empty if the table doesn't exist yet (migration 0007 not applied). */
async function loadRacePredictions(today: string): Promise<RacePredictionRow[]> {
  const { data, error } = await db
    .from("race_predictions")
    .select("date, time_5k_s, time_10k_s, time_half_s, time_marathon_s")
    .gte("date", addDaysIso(today, -30))
    .order("date", { ascending: false });
  return error ? [] : ((data ?? []) as RacePredictionRow[]);
}

function racePredictionsDto(rows: RacePredictionRow[]) {
  const latest = rows[0];
  if (!latest) return null;
  // Garmin only serves the current prediction, so history accrues from the
  // first sync. Compare against the oldest snapshot in the 30-day window.
  const prior = rows.length > 1 ? rows[rows.length - 1]! : null;
  const delta = (cur: number | null, old: number | null | undefined) =>
    cur != null && old != null ? cur - old : null;
  return {
    date: latest.date,
    priorDate: prior?.date ?? null,
    distances: [
      { key: "5k", label: "5K", seconds: latest.time_5k_s, deltaS: delta(latest.time_5k_s, prior?.time_5k_s) },
      { key: "10k", label: "10K", seconds: latest.time_10k_s, deltaS: delta(latest.time_10k_s, prior?.time_10k_s) },
      { key: "half", label: "Half", seconds: latest.time_half_s, deltaS: delta(latest.time_half_s, prior?.time_half_s) },
      { key: "marathon", label: "Marathon", seconds: latest.time_marathon_s, deltaS: delta(latest.time_marathon_s, prior?.time_marathon_s) },
    ],
  };
}

export async function buildDashboard() {
  const today = isoDate(new Date());
  const window = await loadTrainingWindow();
  const evaluation = evaluate(window, today);
  const load = computeWorkloadRatio(window.activities, today);

  const weekStart = mondayOf(today);
  const dates = weekDates(weekStart);
  // Sessions are fetched back far enough to cover the volume chart's lookback
  // too, so matchDay can tell a walk/run-plan walk from unrelated cross-training
  // in those weeks, not just in the current one.
  const volumeStart = addDaysIso(weekStart, -(VOLUME_WEEKS - 1) * 7);

  // Three narrow queries alongside the window. The window's health metrics are
  // mapped to the ENGINE's type, which deliberately has no sleep fields — so
  // the raw rows are fetched separately for display.
  const [{ data: metricRows }, { data: planRows }, { data: recentRows }, vo2Rows, raceRows] = await Promise.all([
    selectTolerant("daily_health_metrics", HEALTH_METRIC_COLUMNS, HEALTH_METRIC_BASE_COLUMNS, (cols) =>
      db
        .from("daily_health_metrics")
        .select(cols)
        .gte("date", addDaysIso(today, -29))
        .lte("date", today)
        .order("date", { ascending: true }),
    ),
    db.from("plan_sessions").select("*").gte("date", volumeStart).lte("date", addDaysIso(weekStart, 20)),
    selectTolerant("activities", ACTIVITY_COLUMNS, ACTIVITY_BASE_COLUMNS, (cols) =>
      db.from("activities").select(cols).order("date", { ascending: false }).limit(RECENT_ACTIVITY_LIMIT),
    ),
    loadVo2Series(),
    loadRacePredictions(today),
  ]);

  const metrics = (metricRows ?? []).map(toHealthMetricsDto);
  const sessions = planRows ?? [];
  const activityRows = window.activities;

  // ---- This week -------------------------------------------------------
  const sessionsOn = sessionsByDate(sessions as any[]);
  const days = dates.map((date) => buildDay(date, sessionsOn.get(date) ?? [], activityRows as any, today));
  const { plannedDistanceM, actualDistanceM, sessionsPlanned, sessionsCompleted } = totalsFor(days);
  const weekTotals = { plannedDistanceM, actualDistanceM, sessionsPlanned, sessionsCompleted };

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
  const vo2Series = vo2Rows.filter((r) => r.vo2_max != null);
  const currentVo2 = vo2Series[0] ?? null;
  const priorVo2 = currentVo2
    ? vo2Series.find((r) => r.date <= addDaysIso(currentVo2.date, -30)) ?? null
    : null;

  // ---- Series ----------------------------------------------------------
  const sparkDates = Array.from({ length: SPARKLINE_DAYS }, (_, i) => addDaysIso(today, -(SPARKLINE_DAYS - 1 - i)));
  const metricFor = (d: string) => metrics.find((m) => m.date === d) ?? null;

  // Run/walk-run totals per week, via the same matchDay machinery as "This
  // week" and the /plan screen — not a raw sum of distanceM, which counted
  // every activity type (cycling, hiking, ...) and so disagreed with the
  // headline number right above it.
  const weeklyVolume = Array.from({ length: VOLUME_WEEKS }, (_, i) => {
    const start = addDaysIso(weekStart, -(VOLUME_WEEKS - 1 - i) * 7);
    const weekDaysView =
      start === weekStart
        ? days
        : weekDates(start).map((date) => buildDay(date, sessionsOn.get(date) ?? [], activityRows as any, today));
    const totals = totalsFor(weekDaysView);
    return {
      weekStart: start,
      weekEnd: weekEndForStart(start),
      number: weekNumberFor(start),
      distanceM: totals.actualDistanceM,
      movingTimeS: totals.actualMovingTimeS,
      sessionsCompleted: totals.sessionsCompleted,
      isCurrent: start === weekStart,
    };
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
      phase: days.find((d) => d.sessions.length)?.sessions[0]?.phase ?? null,
      ...weekTotals,
    },

    today: {
      metrics: todayMetrics,
      restingHrDelta28d,
      sessions: todayDay?.sessions ?? [],
      unplanned: todayDay?.unplanned ?? null,
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

    racePredictions: racePredictionsDto(raceRows),

    race: raceInfo(today),

    sparklines: {
      restingHr: sparkDates.map((d) => metricFor(d)?.restingHr ?? null),
      sleepScore: sparkDates.map((d) => metricFor(d)?.sleep.score ?? null),
      bodyBattery: sparkDates.map((d) => metricFor(d)?.bodyBatteryMax ?? null),
    },

    weeklyVolume,

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
