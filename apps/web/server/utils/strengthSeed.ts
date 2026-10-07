import { exerciseKey, type Kind, type Measure } from "./strength";

// The routines the app starts with. Exercises are named once here and referred
// to by name from the templates, so a movement that appears in two routines
// (single-leg calf raise) is one exercise with one history.

export interface SeedExercise {
  name: string;
  measure: Measure;
  perSide: boolean;
  note: string | null;
  restSeconds: number | null;
}

export interface SeedSlot {
  exercise: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  holdSeconds: number | null;
  restSeconds: number | null;
  supersetGroup: number | null;
  note: string | null;
}

export interface SeedTemplate {
  name: string;
  kind: Kind;
  slots: SeedSlot[];
}

function ex(name: string, over: Partial<Omit<SeedExercise, "name">> = {}): SeedExercise {
  return { name, measure: "reps", perSide: false, note: null, restSeconds: null, ...over };
}

const PHYSIO_PAIN = "Stop and check with your physio if this causes pain along the outside of your lower leg.";

export const SEED_EXERCISES: SeedExercise[] = [
  ex("Conventional deadlift", { restSeconds: 150, note: "Straight bar. 2–3 reps in reserve, 2–3 minutes' rest, no grinding reps." }),
  ex("Bulgarian split squat", { perSide: true }),
  ex("Bench press"),
  ex("Chest-supported row"),
  ex("Seated dumbbell calf raise", { note: "Balls of feet on a plate, slow lowering." }),
  ex("Goblet squat", { note: "Moderate load, nowhere near failure." }),
  ex("Single-leg RDL", { perSide: true }),
  ex("Incline dumbbell press"),
  ex("One-arm dumbbell row", { perSide: true }),
  ex("Pull-ups", { note: "Use band assistance or slow lowering reps if needed." }),
  ex("Single-leg calf raise", { perSide: true }),
  ex("Single-leg pogos", { perSide: true, note: PHYSIO_PAIN }),
  ex("Single-leg circular hops", { perSide: true, note: PHYSIO_PAIN }),
  ex("Penguin march"),
  ex("Banded inversion"),
  ex("Banded eversion", { note: "Targets the peroneals." }),
  ex("Tibialis raise", { note: "Back against a wall, slow lowering." }),
  ex("Single-leg balance", { measure: "hold", perSide: true, note: "Close your eyes once it's easy." }),
  ex("Single-leg glute bridge", { perSide: true, note: "Pause 2 seconds at the top." }),
  ex("Side-lying banded leg raise", { perSide: true, note: "Toes pointing slightly down." }),
  ex("Dead bug", { perSide: true }),
  ex("Side plank", { measure: "hold", perSide: true }),
  ex("Copenhagen plank", { measure: "hold", perSide: true, note: "Start on your knee if needed." }),
];

function reps(exercise: string, sets: number, repsMin: number, repsMax: number = repsMin, over: Partial<SeedSlot> = {}): SeedSlot {
  return { exercise, sets, repsMin, repsMax, holdSeconds: null, restSeconds: null, supersetGroup: null, note: null, ...over };
}

function hold(exercise: string, sets: number, holdSeconds: number, over: Partial<SeedSlot> = {}): SeedSlot {
  return { exercise, sets, repsMin: null, repsMax: null, holdSeconds, restSeconds: null, supersetGroup: null, note: null, ...over };
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: "Gym A",
    kind: "gym",
    slots: [
      reps("Conventional deadlift", 3, 5),
      reps("Bulgarian split squat", 3, 8),
      reps("Bench press", 3, 6, 8, { supersetGroup: 1 }),
      reps("Chest-supported row", 3, 8, 10, { supersetGroup: 1 }),
      reps("Seated dumbbell calf raise", 3, 12, 15),
    ],
  },
  {
    name: "Gym B",
    kind: "gym",
    slots: [
      reps("Goblet squat", 3, 6),
      reps("Single-leg RDL", 3, 8),
      reps("Incline dumbbell press", 3, 8, 10, { supersetGroup: 1 }),
      reps("One-arm dumbbell row", 3, 10, 10, { supersetGroup: 1 }),
      reps("Pull-ups", 3, 6, 10),
      reps("Single-leg calf raise", 3, 12),
    ],
  },
  {
    name: "Physio: ankle",
    kind: "physio",
    slots: [
      reps("Single-leg pogos", 3, 20),
      reps("Single-leg circular hops", 1, 20, 20, { note: "Each direction." }),
      reps("Penguin march", 1, 50),
      reps("Banded inversion", 3, 15),
      reps("Banded eversion", 3, 15),
      reps("Tibialis raise", 3, 15, 20),
      reps("Single-leg calf raise", 3, 12, 15, { note: "Off a step. Hold a weight once 15 feels easy." }),
      hold("Single-leg balance", 3, 30),
    ],
  },
  {
    name: "Physio: hips and core",
    kind: "physio",
    slots: [
      reps("Single-leg glute bridge", 3, 12),
      reps("Side-lying banded leg raise", 3, 15),
      reps("Dead bug", 3, 10),
      hold("Side plank", 3, 30),
      hold("Copenhagen plank", 3, 20),
    ],
  },
];

/**
 * What the seed still has to add, given the exercise and template names that
 * already exist. It only ever adds: anything already there is left exactly as
 * the runner has it, so re-running the seed never undoes an edit.
 */
export function planSeed(
  existingExerciseNames: string[],
  existingTemplateNames: string[],
): { exercises: SeedExercise[]; templates: SeedTemplate[] } {
  const haveExercise = new Set(existingExerciseNames.map(exerciseKey));
  const haveTemplate = new Set(existingTemplateNames.map(exerciseKey));
  return {
    exercises: SEED_EXERCISES.filter((e) => !haveExercise.has(exerciseKey(e.name))),
    templates: SEED_TEMPLATES.filter((t) => !haveTemplate.has(exerciseKey(t.name))),
  };
}
