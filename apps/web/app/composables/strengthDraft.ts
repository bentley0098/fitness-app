import { planGroupSets, restForRound, type LogRow, type LoggedSet, type PlannedSet } from "../../server/utils/strength";

// An in-progress strength session is worked on locally: ticks, edits and set
// counts change the page at once and are kept on this device, and the whole
// session is sent to the server in one go when it is finished. These are the
// pure rules for that draft; the page does the storing.

export interface DraftExercise {
  logExerciseId: string;
  restSeconds: number | null;
  measure: "reps" | "hold";
  rows: LogRow[];
}

export interface DraftGroup<E extends DraftExercise = DraftExercise> {
  superset: boolean;
  sequence: (PlannedSet & { restSeconds: number })[];
  exercises: E[];
}

export interface DraftSession<E extends DraftExercise = DraftExercise> {
  groups: DraftGroup<E>[];
}

type DraftRow = LoggedSet & { logged: boolean };

/** What is kept on the device: every exercise's rows, logged or not. */
export interface Draft {
  version: 1;
  exercises: Record<string, DraftRow[]>;
}

export interface FinishSnapshot {
  exercises: { logExerciseId: string; sets: number; logged: (LoggedSet & { setIndex: number })[] }[];
}

const draftRow = (row: LogRow): DraftRow => ({ logged: row.logged, reps: row.reps, holdSeconds: row.holdSeconds, weightKg: row.weightKg });

export function toDraft(session: DraftSession): Draft {
  const exercises: Draft["exercises"] = {};
  for (const group of session.groups) for (const e of group.exercises) exercises[e.logExerciseId] = e.rows.map(draftRow);
  return { version: 1, exercises };
}

export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    return draft?.version === 1 && draft.exercises && typeof draft.exercises === "object" ? (draft as Draft) : null;
  } catch {
    return null;
  }
}

/** The order and rests of a group's sets, worked out again after its set counts change. */
export function resequence(group: DraftGroup): void {
  const groupRest = restForRound(group.exercises.map((e) => e.restSeconds));
  group.sequence = planGroupSets(group.exercises.map((e) => e.rows.length), group.superset).map((planned) => ({
    ...planned,
    restSeconds: group.superset ? groupRest : restForRound([group.exercises[planned.exercise]!.restSeconds]),
  }));
}

/**
 * Lays a draft over the session as the server has it. Exercises the draft knows
 * take its rows (keeping the server's "last time" beside each); ones it doesn't,
 * such as one just added, keep the server's.
 */
export function applyDraft<S extends DraftSession>(session: S, draft: Draft | null): S {
  if (!draft) return session;
  for (const group of session.groups) {
    let changed = false;
    for (const exercise of group.exercises) {
      const rows = draft.exercises[exercise.logExerciseId];
      if (!rows?.length) continue;
      exercise.rows = rows.map((row, setIndex) => ({
        setIndex,
        logged: Boolean(row.logged),
        reps: exercise.measure === "reps" ? (row.reps ?? null) : null,
        holdSeconds: exercise.measure === "hold" ? (row.holdSeconds ?? null) : null,
        weightKg: exercise.measure === "reps" ? (row.weightKg ?? null) : null,
        previous: exercise.rows[setIndex]?.previous ?? null,
      }));
      changed = true;
    }
    if (changed) resequence(group);
  }
  return session;
}

/** Adds a set row at the end, pre-filled from the last one. */
export function addRow(group: DraftGroup, exercise: DraftExercise): void {
  const last = exercise.rows[exercise.rows.length - 1];
  exercise.rows.push({
    setIndex: exercise.rows.length,
    logged: false,
    reps: last?.reps ?? null,
    holdSeconds: last?.holdSeconds ?? null,
    weightKg: last?.weightKg ?? null,
    previous: null,
  });
  resequence(group);
}

/** Drops the last set row, logged or not. An exercise keeps at least one. */
export function removeRow(group: DraftGroup, exercise: DraftExercise): void {
  if (exercise.rows.length <= 1) return;
  exercise.rows.pop();
  resequence(group);
}

/** Everything the server needs to record the session when it is finished. */
export function finishSnapshot(session: DraftSession): FinishSnapshot {
  return {
    exercises: session.groups.flatMap((group) =>
      group.exercises.map((e) => ({
        logExerciseId: e.logExerciseId,
        sets: e.rows.length,
        logged: e.rows
          .filter((r) => r.logged)
          .map((r) => ({
            setIndex: r.setIndex,
            reps: e.measure === "reps" ? r.reps : null,
            holdSeconds: e.measure === "hold" ? r.holdSeconds : null,
            weightKg: e.measure === "reps" ? r.weightKg : null,
          })),
      })),
    ),
  };
}
