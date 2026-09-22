import { sessionLabel, targetDistanceM, targetDurationS, type Prescription } from "./planLabels";

// Matches planned sessions against real Garmin activities.
//
// This link never existed before: plan_sessions and activities have always
// been independent, and nothing has ever set a session's status to completed.
// Completion is derived HERE, at read time, and deliberately never written
// back — see the note on `derivedStatus` below.

/** Activity types that count as running a session. */
export const RUN_TYPES: ReadonlySet<string> = new Set([
  "running",
  "trail_running",
  "treadmill_running",
  "track_running",
  "indoor_running",
  "virtual_run",
]);

/**
 * Walking counts only for walk/run sessions — which is weeks 1-3 of this plan.
 * Outside that, a walk on a run day isn't the session.
 */
const WALK_TYPES: ReadonlySet<string> = new Set(["walking", "casual_walking", "speed_walking", "hiking"]);
const WALK_RUN_SESSION_TYPES: ReadonlySet<string> = new Set(["walk_run_or_continuous"]);

// Judgement calls, named so they're tunable without archaeology. A session run
// a bit short still counts; one cut in half doesn't.
export const DISTANCE_COMPLETE_RATIO = 0.85;
export const DURATION_COMPLETE_RATIO = 0.8;

export type CompletionState = "rest" | "unplanned" | "completed" | "partial" | "missed" | "upcoming" | "today";

export interface ActivityLike {
  id?: string;
  date: string;
  activity_type?: string | null;
  activityType?: string | null;
  distance_m?: number | null;
  distanceM?: number | null;
  moving_time_s?: number | null;
  movingTimeS?: number | null;
  avg_hr?: number | null;
  avgHr?: number | null;
}

export interface SessionLike {
  id: string;
  date: string;
  phase: string;
  type: string;
  prescription: Prescription | null;
  cap?: unknown;
  status?: string | null;
  revision?: number | null;
  changed_because?: string | null;
  changedBecause?: string | null;
}

export interface Completion {
  state: CompletionState;
  actualDistanceM: number;
  actualMovingTimeS: number;
  targetDistanceM: number | null;
  targetDurationS: number | null;
  /** Actual vs target as a 0-1 fraction, or null when there's no target. */
  pct: number | null;
  activityIds: string[];
  avgHr: number | null;
}

function typeOf(a: ActivityLike): string {
  return (a.activity_type ?? a.activityType ?? "").toLowerCase();
}
function distOf(a: ActivityLike): number {
  return a.distance_m ?? a.distanceM ?? 0;
}
function timeOf(a: ActivityLike): number {
  return a.moving_time_s ?? a.movingTimeS ?? 0;
}
function hrOf(a: ActivityLike): number | null {
  return a.avg_hr ?? a.avgHr ?? null;
}

/** Does this activity count towards a session of `sessionType`? */
export function countsToward(activity: ActivityLike, sessionType: string | null): boolean {
  const t = typeOf(activity);
  if (RUN_TYPES.has(t)) return true;
  if (sessionType && WALK_RUN_SESSION_TYPES.has(sessionType) && WALK_TYPES.has(t)) return true;
  return false;
}

/**
 * Completion for one day.
 *
 * `activities` should already be filtered to that date — matching is on the
 * calendar date alone, because that's the only field both sides share
 * (syncGarmin stores `startTimeLocal.slice(0,10)`; there is no start-time
 * column without reaching into raw_payload). A run logged after midnight
 * therefore lands on the following day.
 */
export function matchDay(session: SessionLike | null, activities: ActivityLike[], todayIso: string): Completion {
  const relevant = activities.filter((a) => countsToward(a, session?.type ?? null));
  const actualDistanceM = relevant.reduce((sum, a) => sum + distOf(a), 0);
  const actualMovingTimeS = relevant.reduce((sum, a) => sum + timeOf(a), 0);
  const activityIds = relevant.map((a) => a.id).filter((id): id is string => !!id);

  const hrs = relevant.map(hrOf).filter((h): h is number => h != null && h > 0);
  const avgHr = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : null;

  const tDist = session ? targetDistanceM(session.prescription) : null;
  const tDur = session ? targetDurationS(session.prescription) : null;

  const base = {
    actualDistanceM,
    actualMovingTimeS,
    targetDistanceM: tDist,
    targetDurationS: tDur,
    activityIds,
    avgHr,
  };

  const pct =
    tDist && tDist > 0
      ? actualDistanceM / tDist
      : tDur && tDur > 0
        ? actualMovingTimeS / tDur
        : null;

  if (!session) {
    return { ...base, pct: null, state: relevant.length ? "unplanned" : "rest" };
  }

  // An explicit status set by a human or the engine wins over anything derived.
  // `pending` is the engine's proposed-revision state, which is about approval,
  // not about whether the run happened — so it isn't handled here.
  if (session.status === "skipped") return { ...base, pct, state: "missed" };

  if (relevant.length > 0) {
    const meetsDistance = tDist != null && tDist > 0 && actualDistanceM >= tDist * DISTANCE_COMPLETE_RATIO;
    const meetsDuration = tDur != null && tDur > 0 && actualMovingTimeS >= tDur * DURATION_COMPLETE_RATIO;
    // Neither target known (race day's {goal, pace}) — any matched run counts.
    const noTarget = tDist == null && tDur == null;
    const done = meetsDistance || meetsDuration || noTarget || session.status === "completed";
    return { ...base, pct, state: done ? "completed" : "partial" };
  }

  if (session.status === "completed") return { ...base, pct, state: "completed" };
  if (session.date < todayIso) return { ...base, pct, state: "missed" };
  if (session.date === todayIso) return { ...base, pct, state: "today" };
  return { ...base, pct, state: "upcoming" };
}

export interface DayView {
  date: string;
  isToday: boolean;
  isPast: boolean;
  session: (SessionLike & { label: string; targetDistanceM: number | null; targetDurationS: number | null }) | null;
  activities: ActivityLike[];
  completion: Completion;
}

export interface WeekTotals {
  plannedDistanceM: number;
  actualDistanceM: number;
  actualMovingTimeS: number;
  sessionsPlanned: number;
  sessionsCompleted: number;
}

export function buildDay(date: string, session: SessionLike | null, activities: ActivityLike[], todayIso: string): DayView {
  const dayActivities = activities.filter((a) => a.date === date);
  const completion = matchDay(session, dayActivities, todayIso);

  return {
    date,
    isToday: date === todayIso,
    isPast: date < todayIso,
    session: session
      ? {
          ...session,
          label: sessionLabel(session.type, session.prescription),
          targetDistanceM: targetDistanceM(session.prescription),
          targetDurationS: targetDurationS(session.prescription),
        }
      : null,
    activities: dayActivities,
    completion,
  };
}

export function totalsFor(days: DayView[]): WeekTotals {
  return days.reduce<WeekTotals>(
    (acc, d) => {
      acc.plannedDistanceM += d.session?.targetDistanceM ?? 0;
      acc.actualDistanceM += d.completion.actualDistanceM;
      acc.actualMovingTimeS += d.completion.actualMovingTimeS;
      if (d.session) acc.sessionsPlanned++;
      if (d.completion.state === "completed") acc.sessionsCompleted++;
      return acc;
    },
    { plannedDistanceM: 0, actualDistanceM: 0, actualMovingTimeS: 0, sessionsPlanned: 0, sessionsCompleted: 0 },
  );
}
