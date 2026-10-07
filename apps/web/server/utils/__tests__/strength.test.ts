import { describe, expect, it } from "vitest";
import { DEFAULT_REST_SECONDS, buildRows, linksToSupersetGroups, supersetGroupsToLinks, exerciseSeries, summariseSession, exerciseKey, latestPerExercise, planGroupSets, restForRound, retarget, findExercise, groupSlots, previousSession, targetLabel, validateSlots, type Exercise, type TemplateSlot } from "../strength";
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

describe("previousSession", () => {
  const set = (weightKg: number) => ({ reps: 8, holdSeconds: null, weightKg });

  it("is the sets from the most recent finished session", () => {
    const past = [
      { date: "2026-10-05", finishedAt: "2026-10-05T18:00:00Z", sets: [set(40)] },
      { date: "2026-10-12", finishedAt: "2026-10-12T18:00:00Z", sets: [set(45)] },
      { date: "2026-10-08", finishedAt: "2026-10-08T18:00:00Z", sets: [set(42)] },
    ];

    expect(previousSession(past)).toEqual([set(45)]);
  });

  it("breaks a tie on the same day by when the session finished", () => {
    const past = [
      { date: "2026-10-12", finishedAt: "2026-10-12T09:00:00Z", sets: [set(40)] },
      { date: "2026-10-12", finishedAt: "2026-10-12T19:00:00Z", sets: [set(50)] },
    ];

    expect(previousSession(past)).toEqual([set(50)]);
  });

  it("is empty when the exercise has never been logged", () => {
    expect(previousSession([])).toEqual([]);
  });
});

describe("buildRows", () => {
  const target = { sets: 3, repsMin: 6, repsMax: 8, holdSeconds: null };
  const done = (reps: number, weightKg: number | null) => ({ reps, holdSeconds: null, weightKg });

  it("leaves the weight blank and uses the target reps for an exercise never logged", () => {
    const rows = buildRows(target, "reps", [], []);

    expect(rows).toEqual([0, 1, 2].map((setIndex) => ({ setIndex, logged: false, reps: 6, holdSeconds: null, weightKg: null, previous: null })));
  });

  it("pre-fills each set from the same set last time and shows those numbers beside it", () => {
    const rows = buildRows(target, "reps", [], [done(8, 40), done(7, 42.5), done(6, 45)]);

    expect(rows.map((r) => [r.reps, r.weightKg])).toEqual([[8, 40], [7, 42.5], [6, 45]]);
    expect(rows.map((r) => r.previous)).toEqual([done(8, 40), done(7, 42.5), done(6, 45)]);
    expect(rows.every((r) => !r.logged)).toBe(true);
  });

  it("falls back to last time's final set when there are more sets today, with nothing beside it", () => {
    const rows = buildRows({ ...target, sets: 4 }, "reps", [], [done(8, 40), done(8, 40), done(7, 42.5)]);

    expect(rows[3]).toMatchObject({ reps: 7, weightKg: 42.5, previous: null });
  });

  it("lets a logged set win over the pre-fill", () => {
    const rows = buildRows(target, "reps", [{ setIndex: 1, reps: 5, holdSeconds: null, weightKg: 47.5 }], [done(8, 40), done(8, 40), done(8, 40)]);

    expect(rows[1]).toMatchObject({ setIndex: 1, logged: true, reps: 5, weightKg: 47.5, previous: done(8, 40) });
    expect(rows[0]).toMatchObject({ logged: false, reps: 8, weightKg: 40 });
  });

  it("keeps a bodyweight exercise's weight blank", () => {
    const rows = buildRows(target, "reps", [], [done(10, null)]);

    expect(rows[0]).toMatchObject({ reps: 10, weightKg: null });
  });

  it("pre-fills a hold from last time, or the target time the first time", () => {
    const hold = { sets: 2, repsMin: null, repsMax: null, holdSeconds: 30 };

    expect(buildRows(hold, "hold", [], []).map((r) => r.holdSeconds)).toEqual([30, 30]);
    expect(buildRows(hold, "hold", [], [{ reps: null, holdSeconds: 40, weightKg: null }]).map((r) => r.holdSeconds)).toEqual([40, 40]);
    expect(buildRows(hold, "hold", [], [])[0]).toMatchObject({ reps: null });
  });
});

describe("latestPerExercise", () => {
  it("picks, for each exercise, its most recent finished session", () => {
    const picked = latestPerExercise([
      { exerciseId: "squat", logExerciseId: "a", date: "2026-10-05", finishedAt: "2026-10-05T10:00:00Z" },
      { exerciseId: "squat", logExerciseId: "b", date: "2026-10-12", finishedAt: "2026-10-12T10:00:00Z" },
      { exerciseId: "row", logExerciseId: "c", date: "2026-10-05", finishedAt: "2026-10-05T10:00:00Z" },
    ]);

    expect(Object.fromEntries(picked)).toEqual({ squat: "b", row: "c" });
  });
});

describe("retarget", () => {
  const repsTarget = { sets: 4, repsMin: 6, repsMax: 8, holdSeconds: null };
  const holdTarget = { sets: 3, repsMin: null, repsMax: null, holdSeconds: 45 };

  it("keeps a slot's targets when the new exercise is measured the same way", () => {
    expect(retarget(repsTarget, "reps")).toEqual(repsTarget);
    expect(retarget(holdTarget, "hold")).toEqual(holdTarget);
  });

  it("keeps the set count but swaps reps for a hold time when the measure changes", () => {
    expect(retarget(repsTarget, "hold")).toEqual({ sets: 4, repsMin: null, repsMax: null, holdSeconds: 30 });
  });

  it("swaps a hold time for reps when the measure changes the other way", () => {
    expect(retarget(holdTarget, "reps")).toEqual({ sets: 3, repsMin: 8, repsMax: 8, holdSeconds: null });
  });

  it("gives an exercise added from nothing three sets", () => {
    expect(retarget(null, "reps")).toEqual({ sets: 3, repsMin: 8, repsMax: 8, holdSeconds: null });
    expect(retarget(null, "hold")).toEqual({ sets: 3, repsMin: null, repsMax: null, holdSeconds: 30 });
  });
});

describe("planGroupSets", () => {
  it("lists a lone exercise's sets in order, resting after each", () => {
    expect(planGroupSets([3], false)).toEqual([
      { exercise: 0, setIndex: 0, restAfter: true },
      { exercise: 0, setIndex: 1, restAfter: true },
      { exercise: 0, setIndex: 2, restAfter: true },
    ]);
  });

  it("alternates the exercises of a superset, resting only after each round", () => {
    expect(planGroupSets([2, 2], true)).toEqual([
      { exercise: 0, setIndex: 0, restAfter: false },
      { exercise: 1, setIndex: 0, restAfter: true },
      { exercise: 0, setIndex: 1, restAfter: false },
      { exercise: 1, setIndex: 1, restAfter: true },
    ]);
  });

  it("copes with one exercise having more sets than the other", () => {
    const order = planGroupSets([3, 2], true);

    expect(order.map((s) => `${s.exercise}:${s.setIndex}`)).toEqual(["0:0", "1:0", "0:1", "1:1", "0:2"]);
    expect(order[order.length - 1]).toMatchObject({ exercise: 0, setIndex: 2, restAfter: true });
  });
});

describe("restForRound", () => {
  it("is the longest rest any exercise in the round asks for", () => {
    expect(restForRound([60, 150])).toBe(150);
  });

  it("uses the 90 second default for an exercise that doesn't say", () => {
    expect(restForRound([null])).toBe(DEFAULT_REST_SECONDS);
    expect(restForRound([60, null])).toBe(DEFAULT_REST_SECONDS);
    expect(DEFAULT_REST_SECONDS).toBe(90);
  });
});

describe("summariseSession", () => {
  it("counts the sets that were done and the exercises they were spread over", () => {
    expect(summariseSession([{ setsLogged: 3 }, { setsLogged: 0 }, { setsLogged: 2 }])).toEqual({ setsDone: 5, exercisesDone: 2 });
  });

  it("is empty for a session with nothing logged", () => {
    expect(summariseSession([])).toEqual({ setsDone: 0, exercisesDone: 0 });
  });
});

describe("exerciseSeries", () => {
  const set = (reps: number | null, weightKg: number | null, holdSeconds: number | null = null) => ({ reps, weightKg, holdSeconds });
  const session = (date: string, ...sets: ReturnType<typeof set>[]) => ({ date, finishedAt: `${date}T18:00:00Z`, sets });

  it("plots the heaviest set of each session, oldest first", () => {
    const series = exerciseSeries(
      [session("2026-10-12", set(8, 45), set(6, 50)), session("2026-10-05", set(8, 40), set(8, 42.5))],
      "reps",
    );

    expect(series).toEqual({
      metric: "weight",
      unit: "kg",
      points: [
        { date: "2026-10-05", value: 42.5 },
        { date: "2026-10-12", value: 50 },
      ],
    });
  });

  it("falls back to the most reps in a set when nothing was ever weighted", () => {
    const series = exerciseSeries([session("2026-10-05", set(10, null), set(12, null)), session("2026-10-12", set(15, null))], "reps");

    expect(series).toMatchObject({ metric: "reps", unit: "reps" });
    expect(series.points.map((p) => p.value)).toEqual([12, 15]);
  });

  it("plots the longest hold for a timed exercise", () => {
    const series = exerciseSeries([session("2026-10-05", set(null, null, 30), set(null, null, 45))], "hold");

    expect(series).toEqual({ metric: "hold", unit: "s", points: [{ date: "2026-10-05", value: 45 }] });
  });

  it("skips a session where nothing was logged for the exercise", () => {
    expect(exerciseSeries([session("2026-10-05")], "reps").points).toEqual([]);
  });
});

describe("superset links", () => {
  it("turns 'superset with the next exercise' toggles into group numbers", () => {
    // squat | bench + row | curl + ext + raise | calf
    expect(linksToSupersetGroups([false, true, false, true, true, false, false])).toEqual([null, 1, 1, 2, 2, 2, null]);
  });

  it("ignores a link on the last exercise, which has nothing to pair with", () => {
    expect(linksToSupersetGroups([false, true])).toEqual([null, null]);
  });

  it("turns group numbers back into links", () => {
    expect(supersetGroupsToLinks([null, 1, 1, 2, 2, 2, null])).toEqual([false, true, false, true, true, false, false]);
  });

  it("round-trips", () => {
    const links = [true, false, false, true, true, false];

    expect(supersetGroupsToLinks(linksToSupersetGroups(links))).toEqual(links);
  });
});
