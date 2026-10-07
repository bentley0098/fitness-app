import { isStrengthType, sessionLabel, targetDistanceM, targetDurationS, type Prescription } from "./planLabels";

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
  /** For a strength session: the log started from it, if any. */
  logId?: string | null;
}

/** A strength log, as far as completion cares. */
export interface StrengthLogLike {
  id: string;
  date: string;
  /** The planned session it was started from; null for a session started on the spot. */
  planSessionId: string | null;
  templateName: string;
  kind: string;
  status: string;
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

export type DaySession = SessionLike & {
  label: string;
  targetDistanceM: number | null;
  targetDurationS: number | null;
  completion: Completion;
};

/**
 * Completion for a planned strength session. It is the runner's own log that
 * decides, never a Garmin activity: finishing the session started from it is
 * what completes it, whichever day that happened on.
 */
export function matchStrength(session: SessionLike, logs: StrengthLogLike[], todayIso: string): Completion {
  const base = {
    actualDistanceM: 0,
    actualMovingTimeS: 0,
    targetDistanceM: null,
    targetDurationS: null,
    pct: null,
    activityIds: [],
    avgHr: null,
  };
  const linked = logs.filter((l) => l.planSessionId === session.id);
  const finished = linked.find((l) => l.status === "finished");
  if (finished) return { ...base, state: "completed", logId: finished.id };

  const underWay = linked.find((l) => l.status === "in_progress");
  if (underWay) return { ...base, state: "partial", logId: underWay.id };

  if (session.status === "skipped") return { ...base, state: "missed", logId: null };
  if (session.date < todayIso) return { ...base, state: "missed", logId: null };
  return { ...base, state: session.date === todayIso ? "today" : "upcoming", logId: null };
}

export interface DayView {
  date: string;
  isToday: boolean;
  isPast: boolean;
  /** Every planned session on the day, each with its own completion. */
  sessions: DaySession[];
  activities: ActivityLike[];
  /** Runs no planned session claimed: "unplanned" when there are any, otherwise "rest". */
  unplanned: Completion;
  /** Strength sessions done that day without starting from a planned one. */
  unplannedStrength: StrengthLogLike[];
}

export interface WeekTotals {
  plannedDistanceM: number;
  actualDistanceM: number;
  actualMovingTimeS: number;
  /** Run sessions only. Strength is counted on its own line. */
  sessionsPlanned: number;
  sessionsCompleted: number;
  strengthPlanned: number;
  strengthCompleted: number;
}

/** How far an activity is from what a session asked for, as a fraction of the ask. */
function mismatch(session: SessionLike, activity: ActivityLike): number {
  const tDist = targetDistanceM(session.prescription);
  if (tDist && tDist > 0) return Math.abs(distOf(activity) - tDist) / tDist;
  const tDur = targetDurationS(session.prescription);
  if (tDur && tDur > 0) return Math.abs(timeOf(activity) - tDur) / tDur;
  return 1;
}

/**
 * Splits a day's activities between its planned runs.
 *
 * A lone planned run takes every activity that counts towards it, as it always
 * has. With several, each activity goes to at most one run and each run gets at
 * most one activity, pairing closest-to-the-ask first. Whatever no run claims is
 * left over, to be shown as an unplanned run.
 */
export function assignActivities(
  allSessions: SessionLike[],
  activities: ActivityLike[],
): { bySession: Map<string, ActivityLike[]>; leftover: ActivityLike[] } {
  // Strength sessions are completed by their log, not by an activity.
  const sessions = allSessions.filter((s) => !isStrengthType(s.type));
  const bySession = new Map<string, ActivityLike[]>(sessions.map((s) => [s.id, []]));

  if (sessions.length === 1) {
    const only = sessions[0]!;
    bySession.set(only.id, activities.filter((a) => countsToward(a, only.type)));
    return { bySession, leftover: activities.filter((a) => !countsToward(a, only.type)) };
  }

  const pairs = sessions.flatMap((session) =>
    activities.filter((a) => countsToward(a, session.type)).map((activity) => ({ session, activity, cost: mismatch(session, activity) })),
  );
  pairs.sort((a, b) => a.cost - b.cost);

  const claimed = new Set<ActivityLike>();
  for (const { session, activity } of pairs) {
    if (claimed.has(activity) || bySession.get(session.id)!.length > 0) continue;
    bySession.get(session.id)!.push(activity);
    claimed.add(activity);
  }
  return { bySession, leftover: activities.filter((a) => !claimed.has(a)) };
}

/** Groups sessions by date, in the order given. */
export function sessionsByDate<T extends { date: string }>(sessions: T[]): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  return byDate;
}

/** For one day: which planned session each of its activities counts towards. */
export function sessionForEachActivity(sessions: SessionLike[], activities: ActivityLike[]): Map<string, SessionLike> {
  const matched = new Map<string, SessionLike>();
  const { bySession } = assignActivities(sessions, activities);
  for (const session of sessions) {
    for (const a of bySession.get(session.id) ?? []) if (a.id) matched.set(a.id, session);
  }
  return matched;
}

export function buildDay(
  date: string,
  sessions: SessionLike[],
  activities: ActivityLike[],
  todayIso: string,
  strengthLogs: StrengthLogLike[] = [],
): DayView {
  const dayActivities = activities.filter((a) => a.date === date);
  const dayLogs = strengthLogs.filter((l) => l.date === date);
  const { bySession, leftover } = assignActivities(sessions, dayActivities);

  return {
    date,
    isToday: date === todayIso,
    isPast: date < todayIso,
    sessions: sessions.map((session) => ({
      ...session,
      label: sessionLabel(session.type, session.prescription),
      targetDistanceM: targetDistanceM(session.prescription),
      targetDurationS: targetDurationS(session.prescription),
      completion: isStrengthType(session.type)
        ? matchStrength(session, strengthLogs, todayIso)
        : matchDay(session, bySession.get(session.id) ?? [], todayIso),
    })),
    activities: dayActivities,
    unplanned: matchDay(null, leftover, todayIso),
    unplannedStrength: dayLogs.filter((l) => l.planSessionId === null),
  };
}

export function totalsFor(days: DayView[]): WeekTotals {
  return days.reduce<WeekTotals>(
    (acc, d) => {
      for (const s of d.sessions) {
        if (isStrengthType(s.type)) {
          acc.strengthPlanned++;
          if (s.completion.state === "completed") acc.strengthCompleted++;
          continue;
        }
        acc.plannedDistanceM += s.targetDistanceM ?? 0;
        acc.actualDistanceM += s.completion.actualDistanceM;
        acc.actualMovingTimeS += s.completion.actualMovingTimeS;
        acc.sessionsPlanned++;
        if (s.completion.state === "completed") acc.sessionsCompleted++;
      }
      acc.actualDistanceM += d.unplanned.actualDistanceM;
      acc.actualMovingTimeS += d.unplanned.actualMovingTimeS;
      return acc;
    },
    {
      plannedDistanceM: 0,
      actualDistanceM: 0,
      actualMovingTimeS: 0,
      sessionsPlanned: 0,
      sessionsCompleted: 0,
      strengthPlanned: 0,
      strengthCompleted: 0,
    },
  );
}

/** Garmin activity types that count as a strength session. */
export const STRENGTH_ACTIVITY_TYPES: ReadonlySet<string> = new Set(["strength_training"]);

/**
 * Pairs strength logs with the Garmin strength activity from the same day, for
 * duration and heart rate only. Completion never depends on this: a session
 * with no watch data is just as done. The earliest log of the day takes the
 * first activity, and each activity goes to one log only.
 */
export function matchStrengthActivities(
  logs: { id: string; date: string; startedAt: string }[],
  activities: ActivityLike[],
): Map<string, ActivityLike> {
  const matched = new Map<string, ActivityLike>();
  const used = new Set<ActivityLike>();
  const ordered = [...logs].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  for (const log of ordered) {
    const activity = activities.find((a) => a.date === log.date && STRENGTH_ACTIVITY_TYPES.has(typeOf(a)) && !used.has(a));
    if (!activity) continue;
    used.add(activity);
    matched.set(log.id, activity);
  }
  return matched;
}

export function durationAndHr(activity: ActivityLike): { durationS: number | null; avgHr: number | null } {
  return { durationS: timeOf(activity) || null, avgHr: hrOf(activity) };
}
