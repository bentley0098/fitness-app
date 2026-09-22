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
import { buildDay, totalsFor, type ActivityLike, type SessionLike } from "./planCompletion";
import { ACTIVITY_COLUMNS, toActivityDto } from "./serialize";

// Shared loading + shaping for the Plan screen. Both the week view and the
// 27-week overview read from the same in-memory snapshot: 99 plan rows and
// ~a few hundred activities is small enough that fetching it whole beats
// paging week-by-week over the network.

export interface PlanSnapshot {
  sessions: SessionLike[];
  activities: ActivityLike[];
  today: string;
}

export async function loadPlanSnapshot(): Promise<PlanSnapshot> {
  const [{ data: sessionRows, error: sessionErr }, { data: activityRows, error: activityErr }] = await Promise.all([
    db.from("plan_sessions").select("*").order("date", { ascending: true }),
    db.from("activities").select(ACTIVITY_COLUMNS).order("date", { ascending: true }),
  ]);

  if (sessionErr) throw createError({ statusCode: 500, statusMessage: `Load plan failed: ${sessionErr.message}` });
  if (activityErr) throw createError({ statusCode: 500, statusMessage: `Load activities failed: ${activityErr.message}` });

  return {
    sessions: (sessionRows ?? []) as SessionLike[],
    activities: (activityRows ?? []) as ActivityLike[],
    today: isoDate(new Date()),
  };
}

function phaseForWeek(sessions: SessionLike[], dates: string[]): string | null {
  const inWeek = sessions.filter((s) => dates.includes(s.date));
  return inWeek[0]?.phase ?? null;
}

/** One week, always seven days Monday-first so the client does no calendar maths. */
export function buildWeek(snapshot: PlanSnapshot, anyDateInWeek: string) {
  const startIso = mondayOf(anyDateInWeek);
  const dates = weekDates(startIso);
  const number = weekNumberFor(startIso);

  const days = dates.map((date) =>
    buildDay(
      date,
      snapshot.sessions.find((s) => s.date === date) ?? null,
      snapshot.activities,
      snapshot.today,
    ),
  );

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
      session: d.session
        ? {
            id: d.session.id,
            date: d.session.date,
            phase: d.session.phase,
            type: d.session.type,
            prescription: d.session.prescription ?? {},
            status: d.session.status ?? "planned",
            revision: d.session.revision ?? 1,
            changedBecause: d.session.changed_because ?? null,
            label: d.session.label,
            targetDistanceM: d.session.targetDistanceM,
            targetDurationS: d.session.targetDurationS,
          }
        : null,
      activities: d.activities.map((a) => toActivityDto(a as Record<string, any>)),
      completion: d.completion,
    })),
  };
}

/** All 27 weeks, aggregated — the collapsible full-plan view. */
export function buildOverview(snapshot: PlanSnapshot) {
  const currentWeekNumber = weekNumberFor(snapshot.today);

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const number = i + 1;
    const startDate = weekStartForNumber(number);
    const dates = weekDates(startDate);
    const days = dates.map((date) =>
      buildDay(
        date,
        snapshot.sessions.find((s) => s.date === date) ?? null,
        snapshot.activities,
        snapshot.today,
      ),
    );
    const totals = totalsFor(days);

    return {
      number,
      startDate,
      endDate: weekEndForStart(startDate),
      phase: phaseForWeek(snapshot.sessions, dates),
      sessionCount: totals.sessionsPlanned,
      ...totals,
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
