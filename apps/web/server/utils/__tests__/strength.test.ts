import { describe, expect, it } from "vitest";
import { exerciseKey, findExercise, groupSlots, targetLabel, validateSlots, type Exercise, type TemplateSlot } from "../strength";
import { SEED_EXERCISES, SEED_TEMPLATES, planSeed } from "../strengthSeed";

function exercise(over: Partial<Exercise> & { id: string; name: string }): Exercise {
  return { measure: "reps", perSide: false, note: null, restSeconds: null, ...over };
}

function slot(over: Partial<TemplateSlot> & { exerciseId: string }): TemplateSlot {
  return { id: `slot-${over.exerciseId}`, sets: 3, repsMin: 8, repsMax: 8, holdSeconds: null, restSeconds: null, supersetGroup: null, note: null, ...over };
}

describe("exercise names", () => {
  it("match regardless of case and surrounding or repeated whitespace", () => {
    expect(exerciseKey("  Bench   Press ")).toBe(exerciseKey("bench press"));
    expect(exerciseKey("Bench press")).not.toBe(exerciseKey("Incline bench press"));
  });

  it("finds an existing exercise from a typed name, and nothing for a new one", () => {
    const library = [exercise({ id: "1", name: "Bench press" }), exercise({ id: "2", name: "Goblet squat" })];

    expect(findExercise(library, "  goblet SQUAT")?.id).toBe("2");
    expect(findExercise(library, "Front squat")).toBeUndefined();
  });
});

describe("targetLabel", () => {
  const bench = exercise({ id: "bench", name: "Bench press" });
  const split = exercise({ id: "split", name: "Bulgarian split squat", perSide: true });
  const plank = exercise({ id: "plank", name: "Side plank", measure: "hold", perSide: true });

  it("shows a fixed rep count", () => {
    expect(targetLabel(slot({ exerciseId: "bench", sets: 3, repsMin: 5, repsMax: 5 }), bench)).toBe("3 × 5");
  });

  it("shows a rep range", () => {
    expect(targetLabel(slot({ exerciseId: "bench", sets: 3, repsMin: 6, repsMax: 8 }), bench)).toBe("3 × 6–8");
  });

  it("marks per-side exercises", () => {
    expect(targetLabel(slot({ exerciseId: "split", sets: 3, repsMin: 8, repsMax: 8 }), split)).toBe("3 × 8 per side");
  });

  it("shows a hold in seconds", () => {
    expect(targetLabel(slot({ exerciseId: "plank", sets: 3, repsMin: null, repsMax: null, holdSeconds: 30 }), plank)).toBe("3 × 30 s per side");
  });
});

describe("groupSlots", () => {
  it("keeps a superset's slots together and leaves the rest alone, in order", () => {
    const slots = [
      slot({ exerciseId: "dl" }),
      slot({ exerciseId: "bench", supersetGroup: 1 }),
      slot({ exerciseId: "row", supersetGroup: 1 }),
      slot({ exerciseId: "calf" }),
    ];

    expect(groupSlots(slots).map((g) => g.slots.map((s) => s.exerciseId))).toEqual([["dl"], ["bench", "row"], ["calf"]]);
    expect(groupSlots(slots).map((g) => g.superset)).toEqual([false, true, false]);
  });
});

describe("validateSlots", () => {
  const library = [
    exercise({ id: "bench", name: "Bench press" }),
    exercise({ id: "row", name: "Row" }),
    exercise({ id: "plank", name: "Plank", measure: "hold" }),
  ];

  it("accepts a well-formed template", () => {
    const slots = [
      slot({ exerciseId: "bench", supersetGroup: 1, repsMin: 6, repsMax: 8 }),
      slot({ exerciseId: "row", supersetGroup: 1 }),
      slot({ exerciseId: "plank", repsMin: null, repsMax: null, holdSeconds: 30 }),
    ];

    expect(validateSlots(slots, library)).toBeNull();
  });

  it("rejects a superset group that is not consecutive", () => {
    const slots = [
      slot({ exerciseId: "bench", supersetGroup: 1 }),
      slot({ exerciseId: "plank", repsMin: null, repsMax: null, holdSeconds: 30 }),
      slot({ exerciseId: "row", supersetGroup: 1 }),
    ];

    expect(validateSlots(slots, library)).toMatch(/consecutive/);
  });

  it("rejects a superset of one", () => {
    expect(validateSlots([slot({ exerciseId: "bench", supersetGroup: 1 })], library)).toMatch(/at least two/);
  });

  it("rejects a reps exercise with no reps, and a hold with no time", () => {
    expect(validateSlots([slot({ exerciseId: "bench", repsMin: null, repsMax: null })], library)).toMatch(/reps/);
    expect(validateSlots([slot({ exerciseId: "plank", repsMin: null, repsMax: null, holdSeconds: null })], library)).toMatch(/hold/);
  });

  it("rejects a rep range that runs backwards and a slot with no sets", () => {
    expect(validateSlots([slot({ exerciseId: "bench", repsMin: 10, repsMax: 8 })], library)).toMatch(/range/);
    expect(validateSlots([slot({ exerciseId: "bench", sets: 0 })], library)).toMatch(/set/);
  });

  it("rejects a slot whose exercise is not in the library", () => {
    expect(validateSlots([slot({ exerciseId: "ghost" })], library)).toMatch(/exercise/);
  });
});

describe("the seeded routines", () => {
  const byName = new Map(SEED_TEMPLATES.map((t) => [t.name, t]));

  it("has the four routines, two gym and two physio", () => {
    expect([...byName.keys()].sort()).toEqual(["Gym A", "Gym B", "Physio: ankle", "Physio: hips and core"]);
    expect(byName.get("Gym A")?.kind).toBe("gym");
    expect(byName.get("Gym B")?.kind).toBe("gym");
    expect(byName.get("Physio: ankle")?.kind).toBe("physio");
    expect(byName.get("Physio: hips and core")?.kind).toBe("physio");
  });

  it("names each exercise once, however differently the routines spell it", () => {
    const keys = SEED_EXERCISES.map((e) => exerciseKey(e.name));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("shares single-leg calf raise between Gym B and the ankle routine", () => {
    const uses = (template: string) => byName.get(template)!.slots.map((s) => exerciseKey(s.exercise));
    expect(uses("Gym B")).toContain(exerciseKey("Single-leg calf raise"));
    expect(uses("Physio: ankle")).toContain(exerciseKey("Single-leg calf raise"));
  });

  it("pairs bench with the row, and incline press with the one-arm row, as supersets", () => {
    const groups = (template: string) =>
      groupSlots(byName.get(template)!.slots.map((s, i) => ({ ...s, id: String(i), exerciseId: s.exercise }) as unknown as TemplateSlot))
        .filter((g) => g.superset)
        .map((g) => g.slots.map((s) => s.exerciseId));
    expect(groups("Gym A")).toEqual([["Bench press", "Chest-supported row"]]);
    expect(groups("Gym B")).toEqual([["Incline dumbbell press", "One-arm dumbbell row"]]);
  });

  it("gives the deadlift two and a half minutes' rest", () => {
    const deadlift = SEED_EXERCISES.find((e) => exerciseKey(e.name) === exerciseKey("Conventional deadlift"));
    expect(deadlift?.restSeconds).toBe(150);
  });

  it("is valid under the same rules as the template editor", () => {
    const library = SEED_EXERCISES.map((e) => exercise({ ...e, id: e.name }));
    for (const template of SEED_TEMPLATES) {
      const slots = template.slots.map((s, i) => ({ id: String(i), exerciseId: s.exercise, ...s })) as unknown as TemplateSlot[];
      expect(validateSlots(slots, library), template.name).toBeNull();
    }
  });
});

describe("planSeed", () => {
  it("adds everything to an empty library", () => {
    const plan = planSeed([], []);

    expect(plan.exercises).toHaveLength(SEED_EXERCISES.length);
    expect(plan.templates.map((t) => t.name)).toEqual(SEED_TEMPLATES.map((t) => t.name));
  });

  it("adds nothing on a second run", () => {
    const plan = planSeed(SEED_EXERCISES.map((e) => e.name), SEED_TEMPLATES.map((t) => t.name));

    expect(plan).toEqual({ exercises: [], templates: [] });
  });

  it("never overwrites a template the runner has already got, whatever its spelling", () => {
    const plan = planSeed(SEED_EXERCISES.map((e) => e.name.toUpperCase()), ["  gym a ", "GYM B"]);

    expect(plan.exercises).toEqual([]);
    expect(plan.templates.map((t) => t.name)).toEqual(["Physio: ankle", "Physio: hips and core"]);
  });
});
