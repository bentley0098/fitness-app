// Pure rules for strength work: exercise identity, what a template slot asks
// for, and whether a template is well-formed. No I/O — the endpoints and the
// seed script load rows, call these, and execute whatever comes back.

export type Measure = "reps" | "hold";
export type Kind = "gym" | "physio";

export interface Exercise {
  id: string;
  name: string;
  /** Reps with an optional weight, or a timed hold. */
  measure: Measure;
  /** One logged number applies to each side. */
  perSide: boolean;
  note: string | null;
  /** Seconds of rest after a set; null means the app default. */
  restSeconds: number | null;
}

export interface TemplateSlot {
  id: string;
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  holdSeconds: number | null;
  restSeconds: number | null;
  /** Consecutive slots sharing a number are a superset. */
  supersetGroup: number | null;
  note: string | null;
}

export const DEFAULT_REST_SECONDS = 90;

/** The identity of an exercise name: case, spacing and surrounding space don't matter. */
export function exerciseKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function findExercise<T extends { name: string }>(exercises: T[], name: string): T | undefined {
  const key = exerciseKey(name);
  return exercises.find((e) => exerciseKey(e.name) === key);
}

/** "3 × 6–8", "3 × 8 per side", "3 × 30 s per side". */
export function targetLabel(slot: TemplateSlot, exercise: Pick<Exercise, "measure" | "perSide">): string {
  const side = exercise.perSide ? " per side" : "";
  if (exercise.measure === "hold") return `${slot.sets} × ${slot.holdSeconds ?? "?"} s${side}`;
  const { repsMin, repsMax } = slot;
  const reps = repsMin == null ? "?" : repsMax == null || repsMax === repsMin ? `${repsMin}` : `${repsMin}–${repsMax}`;
  return `${slot.sets} × ${reps}${side}`;
}

export interface SlotGroup {
  superset: boolean;
  slots: TemplateSlot[];
}

/** Slots in order, with each superset's slots gathered into one group. */
export function groupSlots(slots: TemplateSlot[]): SlotGroup[] {
  const groups: SlotGroup[] = [];
  for (const s of slots) {
    const last = groups[groups.length - 1];
    if (s.supersetGroup != null && last?.superset && last.slots[0]!.supersetGroup === s.supersetGroup) {
      last.slots.push(s);
    } else {
      groups.push({ superset: s.supersetGroup != null, slots: [s] });
    }
  }
  return groups;
}

/** The first problem with a template's slots, or null when they are fine. */
export function validateSlots(slots: TemplateSlot[], exercises: Pick<Exercise, "id" | "name" | "measure">[]): string | null {
  const byId = new Map(exercises.map((e) => [e.id, e]));

  for (const slot of slots) {
    const exercise = byId.get(slot.exerciseId);
    if (!exercise) return `A slot uses an exercise that isn't in the library (${slot.exerciseId}).`;
    if (!Number.isInteger(slot.sets) || slot.sets < 1) return `${exercise.name} needs at least one set.`;

    if (exercise.measure === "hold") {
      if (slot.holdSeconds == null || slot.holdSeconds < 1) return `${exercise.name} is a hold and needs a hold time.`;
    } else {
      if (slot.repsMin == null || slot.repsMin < 1) return `${exercise.name} needs a number of reps.`;
      if (slot.repsMax != null && slot.repsMax < slot.repsMin) return `${exercise.name} has a rep range that runs backwards.`;
    }
  }

  const seen = new Set<number>();
  let previous: number | null = null;
  for (const slot of slots) {
    const group = slot.supersetGroup;
    if (group != null && group !== previous && seen.has(group)) return "A superset's exercises must be consecutive.";
    if (group != null) seen.add(group);
    previous = group;
  }
  for (const group of seen) {
    if (slots.filter((s) => s.supersetGroup === group).length < 2) return "A superset needs at least two exercises.";
  }

  return null;
}

export interface LoggedSet {
  reps: number | null;
  holdSeconds: number | null;
  weightKg: number | null;
}

/** One exercise as it was done in one finished session. */
export interface PastSession {
  date: string;
  finishedAt: string | null;
  sets: LoggedSet[];
}

/** The sets from the most recent finished session of an exercise, or none if it has never been logged. */
export function previousSession(past: PastSession[]): LoggedSet[] {
  let latest: PastSession | null = null;
  for (const session of past) {
    const newer =
      !latest ||
      session.date > latest.date ||
      (session.date === latest.date && (session.finishedAt ?? "") > (latest.finishedAt ?? ""));
    if (newer) latest = session;
  }
  return latest?.sets ?? [];
}

export interface LogRow extends LoggedSet {
  setIndex: number;
  logged: boolean;
  /** What this set was last time, shown beside it; null if last time had no such set. */
  previous: LoggedSet | null;
}

/**
 * The set rows for one exercise in a session.
 *
 * A set already logged shows what was logged. One not yet logged is pre-filled
 * from the same set last time, falling back to last time's final set when there
 * are more sets today. With no history the reps (or hold time) come from the
 * target and the weight is left blank: a weight is only ever remembered, never
 * invented.
 */
export function buildRows(
  target: Pick<TemplateSlot, "sets" | "repsMin" | "repsMax" | "holdSeconds">,
  measure: Measure,
  logged: (LoggedSet & { setIndex: number })[],
  previous: LoggedSet[],
): LogRow[] {
  const byIndex = new Map(logged.map((s) => [s.setIndex, s]));

  return Array.from({ length: target.sets }, (_, setIndex) => {
    const was = previous[setIndex] ?? null;
    const done = byIndex.get(setIndex);
    if (done) {
      return { setIndex, logged: true, reps: done.reps, holdSeconds: done.holdSeconds, weightKg: done.weightKg, previous: was };
    }

    const source = was ?? previous[previous.length - 1] ?? null;
    return {
      setIndex,
      logged: false,
      reps: measure === "reps" ? (source?.reps ?? target.repsMin) : null,
      holdSeconds: measure === "hold" ? (source?.holdSeconds ?? target.holdSeconds) : null,
      weightKg: measure === "reps" ? (source?.weightKg ?? null) : null,
      previous: was,
    };
  });
}

/** For each exercise, the log-exercise of its most recent finished session. */
export function latestPerExercise(
  candidates: { exerciseId: string; logExerciseId: string; date: string; finishedAt: string | null }[],
): Map<string, string> {
  const best = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    const current = best.get(c.exerciseId);
    const newer =
      !current || c.date > current.date || (c.date === current.date && (c.finishedAt ?? "") > (current.finishedAt ?? ""));
    if (newer) best.set(c.exerciseId, c);
  }
  return new Map([...best].map(([exerciseId, c]) => [exerciseId, c.logExerciseId]));
}

export type Target = Pick<TemplateSlot, "sets" | "repsMin" | "repsMax" | "holdSeconds">;

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 8;
const DEFAULT_HOLD_SECONDS = 30;

/**
 * The targets for an exercise dropped into a slot (or added with no slot at all):
 * the slot's set count and targets are kept when the measure matches, and
 * replaced with a plain default when it doesn't, since 8 reps means nothing to
 * a plank.
 */
export function retarget(slot: Target | null, measure: Measure): Target {
  const sets = slot?.sets ?? DEFAULT_SETS;
  if (measure === "hold") {
    return { sets, repsMin: null, repsMax: null, holdSeconds: slot?.holdSeconds ?? DEFAULT_HOLD_SECONDS };
  }
  const repsMin = slot?.repsMin ?? DEFAULT_REPS;
  return { sets, repsMin, repsMax: slot?.repsMax ?? repsMin, holdSeconds: null };
}

export interface PlannedSet {
  /** Index into the group's exercises. */
  exercise: number;
  setIndex: number;
  /** Whether the rest timer starts once this set is logged. */
  restAfter: boolean;
}

/**
 * The order a group's sets are done in. A lone exercise runs set by set. A
 * superset goes round by round, one set of each exercise in turn, and rests only
 * after the last set of each round.
 */
export function planGroupSets(setCounts: number[], superset: boolean): PlannedSet[] {
  if (!superset) {
    return setCounts.flatMap((count, exercise) =>
      Array.from({ length: count }, (_, setIndex) => ({ exercise, setIndex, restAfter: true })),
    );
  }

  const rounds = Math.max(0, ...setCounts);
  const planned: PlannedSet[] = [];
  for (let setIndex = 0; setIndex < rounds; setIndex++) {
    const inRound = setCounts.map((count, exercise) => ({ count, exercise })).filter((e) => e.count > setIndex);
    inRound.forEach((e, i) => planned.push({ exercise: e.exercise, setIndex, restAfter: i === inRound.length - 1 }));
  }
  return planned;
}

/** Rest after a round: the longest any exercise in it asks for. */
export function restForRound(restSeconds: (number | null)[]): number {
  return Math.max(...restSeconds.map((r) => r ?? DEFAULT_REST_SECONDS));
}

/** What a session amounts to, for a history row: sets done, and exercises with at least one. */
export function summariseSession(exercises: { setsLogged: number }[]): { setsDone: number; exercisesDone: number } {
  return {
    setsDone: exercises.reduce((sum, e) => sum + e.setsLogged, 0),
    exercisesDone: exercises.filter((e) => e.setsLogged > 0).length,
  };
}

export interface ExerciseSeries {
  metric: "weight" | "reps" | "hold";
  unit: "kg" | "reps" | "s";
  points: { date: string; value: number }[];
}

/**
 * One value per finished session, oldest first: the heaviest set, or the most
 * reps in a set if the exercise has never been weighted, or the longest hold.
 */
export function exerciseSeries(sessions: PastSession[], measure: Measure): ExerciseSeries {
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""));

  const max = (values: (number | null)[]): number | null => {
    const real = values.filter((v): v is number => v != null);
    return real.length ? Math.max(...real) : null;
  };
  const pointsOf = (pick: (s: LoggedSet) => number | null) =>
    ordered.flatMap((s) => {
      const value = max(s.sets.map(pick));
      return value == null ? [] : [{ date: s.date, value }];
    });

  if (measure === "hold") return { metric: "hold", unit: "s", points: pointsOf((s) => s.holdSeconds) };

  const weighted = pointsOf((s) => s.weightKg);
  if (weighted.length > 0) return { metric: "weight", unit: "kg", points: weighted };
  return { metric: "reps", unit: "reps", points: pointsOf((s) => s.reps) };
}
