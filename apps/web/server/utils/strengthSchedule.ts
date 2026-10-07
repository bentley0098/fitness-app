import { addDaysIso } from "./dates";
import { mondayOf } from "./planMeta";
import { SEED_TEMPLATES } from "./strengthSeed";

// When the seeded routines fall in the plan, and how a re-run of the seed
// reconciles with what is already scheduled. Pure: the seed script loads rows,
// calls these, and writes whatever comes back.

/** Marks planned strength sessions the seed created, so a re-run only ever touches those. */
export const SEED_MARKER = "strength-seed";

export interface ScheduledSession {
  date: string;
  phase: string;
  type: "strength_gym" | "strength_physio";
  templateName: string;
}

// 0 = Monday ... 6 = Sunday.
const WEEKLY_PATTERN: { weekday: number; template: string }[] = [
  { weekday: 0, template: "Gym A" },
  { weekday: 0, template: "Physio: ankle" },
  { weekday: 2, template: "Physio: ankle" },
  { weekday: 4, template: "Gym B" },
  { weekday: 6, template: "Physio: hips and core" },
];

const KIND_BY_TEMPLATE = new Map(SEED_TEMPLATES.map((t) => [t.name, t.kind]));

function weekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 6 : day - 1;
}

/**
 * The seeded routines on their weekdays, from today through the Sunday before
 * race week. Each takes the phase of its week in the plan, or the last phase
 * seen if that week has no runs.
 */
export function planStrengthSchedule(input: {
  today: string;
  raceDate: string;
  phaseForWeek: (weekStart: string) => string | null;
}): ScheduledSession[] {
  const end = addDaysIso(mondayOf(input.raceDate), -1);
  const scheduled: ScheduledSession[] = [];
  let lastPhase = "base";

  for (let date = input.today; date <= end; date = addDaysIso(date, 1)) {
    const phase = input.phaseForWeek(mondayOf(date));
    if (phase) lastPhase = phase;

    for (const entry of WEEKLY_PATTERN.filter((p) => p.weekday === weekday(date))) {
      const kind = KIND_BY_TEMPLATE.get(entry.template);
      if (!kind) continue;
      scheduled.push({
        date,
        phase: phase ?? lastPhase,
        type: kind === "gym" ? "strength_gym" : "strength_physio",
        templateName: entry.template,
      });
    }
  }
  return scheduled;
}

export interface ExistingSeeded {
  id: string;
  date: string;
  templateId: string;
  revision: number;
  /** A strength log was started from it. */
  hasLog: boolean;
}

/**
 * Reconciles the schedule with the seeded sessions already in the plan.
 *
 * A session that is exactly where it should be stays. One you have moved or
 * edited, or that already has a log, is never deleted, and counts as filling
 * its slot that week so the seed does not add a second. Anything else the seed
 * created that is no longer scheduled is removed. Past sessions are left alone.
 */
export function diffSchedule(
  desired: ScheduledSession[],
  existing: ExistingSeeded[],
  templateIdOf: (templateName: string) => string,
  today: string,
): { insert: ScheduledSession[]; deleteIds: string[] } {
  const upcoming = existing.filter((e) => e.date >= today);
  const used = new Set<string>();
  const unmet: ScheduledSession[] = [];

  for (const d of desired) {
    const exact = upcoming.find((e) => !used.has(e.id) && e.date === d.date && e.templateId === templateIdOf(d.templateName));
    if (exact) used.add(exact.id);
    else unmet.push(d);
  }

  const touched = (e: ExistingSeeded) => e.revision > 1 || e.hasLog;
  const deleteIds: string[] = [];
  const insert: ScheduledSession[] = [];

  const filledBy = new Map<string, number>();
  for (const e of upcoming) {
    if (used.has(e.id)) continue;
    if (touched(e)) filledBy.set(`${mondayOf(e.date)}|${e.templateId}`, (filledBy.get(`${mondayOf(e.date)}|${e.templateId}`) ?? 0) + 1);
    else deleteIds.push(e.id);
  }

  for (const d of unmet) {
    const key = `${mondayOf(d.date)}|${templateIdOf(d.templateName)}`;
    const left = filledBy.get(key) ?? 0;
    if (left > 0) filledBy.set(key, left - 1);
    else insert.push(d);
  }

  return { insert, deleteIds };
}
