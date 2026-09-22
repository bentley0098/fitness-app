import { addDaysIso } from "./dates";

// Plan-wide constants and ISO-week arithmetic.
//
// Grouping is by ISO Monday, never by a hard-coded weekday pattern. That holds
// regardless of the one-day anchor drift that fix-plan-dates.ts corrects:
// even with the old Tue/Thu/Sat/Sun dates, a week's four sessions spanned
// Tue..Sun and still fell inside a single Mon-Sun week.

export const RACE_DATE = "2027-03-14";
export const RACE_NAME = "Barcelona Marathon";
/** Monday of plan week 1. Week 1 is irregular — it starts Thursday 2026-09-10. */
export const PLAN_START_MONDAY = "2026-09-07";
export const TOTAL_WEEKS = 27;

const MS_PER_DAY = 86_400_000;

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso).getTime() - toUtc(fromIso).getTime()) / MS_PER_DAY);
}

/** The ISO Monday on or before `iso`. */
export function mondayOf(iso: string): string {
  const day = toUtc(iso).getUTCDay(); // 0 = Sunday
  const backtrack = day === 0 ? 6 : day - 1;
  return addDaysIso(iso, -backtrack);
}

/** 1-based plan week, clamped to [1, TOTAL_WEEKS] for dates outside the plan. */
export function weekNumberFor(iso: string): number {
  const weeks = Math.floor(daysBetween(PLAN_START_MONDAY, mondayOf(iso)) / 7) + 1;
  return Math.min(Math.max(weeks, 1), TOTAL_WEEKS);
}

export function weekStartForNumber(n: number): string {
  const clamped = Math.min(Math.max(Math.floor(n), 1), TOTAL_WEEKS);
  return addDaysIso(PLAN_START_MONDAY, (clamped - 1) * 7);
}

export function weekEndForStart(startIso: string): string {
  return addDaysIso(startIso, 6);
}

/** The seven ISO dates of the week containing `iso`, Monday first. */
export function weekDates(iso: string): string[] {
  const start = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
}

export function daysUntilRace(todayIso: string): number {
  return daysBetween(todayIso, RACE_DATE);
}

export const FIRST_WEEK_START = PLAN_START_MONDAY;
export const LAST_WEEK_START = weekStartForNumber(TOTAL_WEEKS);
