import { db } from "./db";
import { isoDate } from "./dates";
import {
  FIRST_WEEK_START,
  LAST_WEEK_START,
  RACE_DATE,
  RACE_NAME,
  TOTAL_WEEKS,
  daysUntilRace,
  mondayOf,
  weekDates,
  weekEndForStart,
  weekNumberFor,
  weekStartForNumber,
} from "./planMeta";
import { buildDay, sessionsByDate, totalsFor, type ActivityLike, type DaySession, type SessionLike, type StrengthLogLike } from "./planCompletion";
import { isStrengthType } from "./planLabels";
import { loadStrengthLogsLike } from "./strengthLogs";
import { selectTolerant } from "./optionalColumns";
import { ACTIVITY_BASE_COLUMNS, ACTIVITY_COLUMNS, toActivityDto } from "./serialize";

// Shared loading + shaping for the Plan screen. Both the week view and the
// 27-week overview read from the same in-memory snapshot: 99 plan rows and
// ~a few hundred activities is small enough that fetching it whole beats
// paging week-by-week over the network.

export interface PlanSnapshot {
  sessions: SessionLike[];
  activities: ActivityLike[];
  strengthLogs: StrengthLogLike[];
  today: string;
}

export async function loadPlanSnapshot(): Promise<PlanSnapshot> {
  const [{ data: sessionRows, error: sessionErr }, { data: activityRows, error: activityErr }, strengthLogs] = await Promise.all([
    db.from("plan_sessions").select("*").order("date", { ascending: true }),
    selectTolerant("activities", ACTIVITY_COLUMNS, ACTIVITY_BASE_COLUMNS, (cols) =>
      db.from("activities").select(cols).order("date", { ascending: true }),
    ),
    loadStrengthLogsLike(),
  ]);

  if (sessionErr) throw createError({ statusCode: 500, statusMessage: `Load plan failed: ${sessionErr.message}` });
  if (activityErr) throw createError({ statusCode: 500, statusMessage: `Load activities failed: ${activityErr.message}` });

  return {
    sessions: (sessionRows ?? []) as SessionLike[],
    activities: (activityRows ?? []) as ActivityLike[],
    strengthLogs,
    today: isoDate(new Date()),
  };
}

function phaseForWeek(sessions: SessionLike[], dates: string[]): string | null {
  const inWeek = sessions.filter((s) => dates.includes(s.date));
  return inWeek[0]?.phase ?? null;
}

function toSessionDto(s: DaySession) {
  return {
    id: s.id,
    date: s.date,
    phase: s.phase,
    type: s.type,
    prescription: s.prescription ?? {},
    status: s.status ?? "planned",
    revision: s.revision ?? 1,
    changedBecause: s.changed_because ?? null,
    label: s.label,
    targetDistanceM: s.targetDistanceM,
    targetDurationS: s.targetDurationS,
    completion: s.completion,
    isStrength: isStrengthType(s.type),
    templateId: typeof s.prescription?.templateId === "string" ? s.prescription.templateId : null,
  };
}

/** One week, always seven days Monday-first so the client does no calendar maths. */
export function buildWeek(snapshot: PlanSnapshot, anyDateInWeek: string) {
  const startIso = mondayOf(anyDateInWeek);
  const dates = weekDates(startIso);
  const number = weekNumberFor(startIso);

  const sessionsOn = sessionsByDate(snapshot.sessions);
  const days = dates.map((date) => buildDay(date, sessionsOn.get(date) ?? [], snapshot.activities, snapshot.today, snapshot.strengthLogs));

  const totals = totalsFor(days);

  return {
    week: {
      number,
      startDate: startIso,
      endDate: weekEndForStart(startIso),
      phase: phaseForWeek(snapshot.sessions, dates),
      ...totals,
    },
    nav: {
      prevWeekStart: startIso > FIRST_WEEK_START ? weekStartForNumber(number - 1) : null,
      nextWeekStart: startIso < LAST_WEEK_START ? weekStartForNumber(number + 1) : null,
      currentWeekStart: mondayOf(snapshot.today),
      firstWeekStart: FIRST_WEEK_START,
      lastWeekStart: LAST_WEEK_START,
    },
    days: days.map((d) => ({
      date: d.date,
      isToday: d.isToday,
      isPast: d.isPast,
      sessions: d.sessions.map(toSessionDto),
      activities: d.activities.map((a) => toActivityDto(a as Record<string, any>)),
      unplanned: d.unplanned,
      unplannedStrength: d.unplannedStrength,
    })),
  };
}

/** All 27 weeks, aggregated — the collapsible full-plan view. */
export function buildOverview(snapshot: PlanSnapshot) {
  const currentWeekNumber = weekNumberFor(snapshot.today);
  const sessionsOn = sessionsByDate(snapshot.sessions);

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const number = i + 1;
    const startDate = weekStartForNumber(number);
    const dates = weekDates(startDate);
    const days = dates.map((date) => buildDay(date, sessionsOn.get(date) ?? [], snapshot.activities, snapshot.today, snapshot.strengthLogs));
    const totals = totalsFor(days);

    return {
      number,
      startDate,
      endDate: weekEndForStart(startDate),
      phase: phaseForWeek(snapshot.sessions, dates),
      sessionCount: totals.sessionsPlanned,
      ...totals,
      // The week card's session list: one row per planned session, with the
      // derived completion state so the client can strike finished ones.
      sessions: days.flatMap((d) =>
        d.sessions.map((session) => ({
          id: session.id,
          date: d.date,
          type: session.type,
          label: session.label,
          targetDistanceM: session.targetDistanceM,
          state: session.completion.state,
          actualDistanceM: session.completion.actualDistanceM,
        })),
      ),
      status: number < currentWeekNumber ? "done" : number === currentWeekNumber ? "current" : "upcoming",
    };
  });

  // Scale ships from the server so the overview's bars and any other consumer
  // can't disagree about the maximum.
  const maxPlannedDistanceM = Math.max(...weeks.map((w) => w.plannedDistanceM), 1);

  // Contiguous runs of the same phase, for the phase ribbon.
  const phases: { phase: string; startWeek: number; endWeek: number }[] = [];
  for (const w of weeks) {
    if (!w.phase) continue;
    const last = phases[phases.length - 1];
    if (last && last.phase === w.phase && last.endWeek === w.number - 1) last.endWeek = w.number;
    else phases.push({ phase: w.phase, startWeek: w.number, endWeek: w.number });
  }

  return {
    race: raceInfo(snapshot.today),
    totalWeeks: TOTAL_WEEKS,
    currentWeekNumber,
    maxPlannedDistanceM,
    weeks,
    phases,
  };
}

export function raceInfo(todayIso: string) {
  return {
    name: RACE_NAME,
    date: RACE_DATE,
    daysUntil: daysUntilRace(todayIso),
    weekNumber: weekNumberFor(todayIso),
    totalWeeks: TOTAL_WEEKS,
  };
}
