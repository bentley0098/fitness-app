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
