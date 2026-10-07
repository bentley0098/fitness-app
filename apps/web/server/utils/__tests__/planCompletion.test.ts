import { describe, expect, it } from "vitest";
import { buildDay, countsToward, matchDay, sessionForEachActivity, totalsFor, type SessionLike } from "../planCompletion";

const TODAY = "2026-09-22";

function session(over: Partial<SessionLike> = {}): SessionLike {
  return {
    id: "s1",
    date: TODAY,
    phase: "base",
    type: "easy_run",
    prescription: { distanceKm: 5 },
    status: "planned",
    revision: 1,
    ...over,
  };
}

function run(over: Record<string, unknown> = {}) {
  return { id: "a1", date: TODAY, activity_type: "running", distance_m: 5000, moving_time_s: 1800, ...over };
}

describe("countsToward", () => {
  it("accepts every running variant", () => {
    for (const t of ["running", "trail_running", "treadmill_running", "track_running", "indoor_running"]) {
      expect(countsToward({ date: TODAY, activity_type: t }, "easy_run")).toBe(true);
    }
  });

  it("counts walking ONLY for a walk/run session", () => {
    const walk = { date: TODAY, activity_type: "walking" };
    expect(countsToward(walk, "walk_run_or_continuous")).toBe(true);
    expect(countsToward(walk, "easy_run")).toBe(false);
    expect(countsToward(walk, null)).toBe(false);
  });

  it("ignores unrelated sports", () => {
    expect(countsToward({ date: TODAY, activity_type: "cycling" }, "easy_run")).toBe(false);
  });
});

describe("matchDay states", () => {
  it("rest — no session and no activity", () => {
    expect(matchDay(null, [], TODAY).state).toBe("rest");
  });

  it("unplanned — an activity with no session", () => {
    const c = matchDay(null, [run()], TODAY);
    expect(c.state).toBe("unplanned");
    expect(c.actualDistanceM).toBe(5000);
  });

  it("completed — target met", () => {
    expect(matchDay(session(), [run()], TODAY).state).toBe("completed");
  });

  it("completed — at exactly the 85% distance threshold", () => {
    expect(matchDay(session(), [run({ distance_m: 4250 })], TODAY).state).toBe("completed");
  });

  it("partial — just under the threshold", () => {
    const c = matchDay(session(), [run({ distance_m: 4249 })], TODAY);
    expect(c.state).toBe("partial");
    expect(c.pct).toBeCloseTo(0.8498, 3);
  });

  it("missed — a past session with nothing logged", () => {
    expect(matchDay(session({ date: "2026-09-20" }), [], TODAY).state).toBe("missed");
  });

  it("today vs upcoming for an unrun session", () => {
    expect(matchDay(session(), [], TODAY).state).toBe("today");
    expect(matchDay(session({ date: "2026-09-25" }), [], TODAY).state).toBe("upcoming");
  });

  it("sums several runs on one day", () => {
    const c = matchDay(session(), [run({ distance_m: 2600 }), run({ id: "a2", distance_m: 2600 })], TODAY);
    expect(c.actualDistanceM).toBe(5200);
    expect(c.state).toBe("completed");
    expect(c.activityIds).toEqual(["a1", "a2"]);
  });
});

describe("matchDay thresholds by prescription shape", () => {
  it("falls back to duration when the session has no distance target", () => {
    const s = session({ type: "walk_run_or_continuous", prescription: { durationMin: 15, ratio: "2:2" } });
    // 12 min of 15 = exactly the 80% duration threshold.
    expect(matchDay(s, [run({ distance_m: 0, moving_time_s: 720 })], TODAY).state).toBe("completed");
    expect(matchDay(s, [run({ distance_m: 0, moving_time_s: 700 })], TODAY).state).toBe("partial");
  });

  it("counts any run when neither target is known (race day)", () => {
    const s = session({ type: "marathon", prescription: { goal: "sub-3:30", pace: "4:58/km" } });
    const c = matchDay(s, [run({ distance_m: 100 })], TODAY);
    expect(c.state).toBe("completed");
    expect(c.pct).toBeNull();
  });
});

describe("explicit status", () => {
  it("skipped reads as missed even before the date passes", () => {
    expect(matchDay(session({ date: "2026-09-25", status: "skipped" }), [], TODAY).state).toBe("missed");
  });

  it("completed is honoured with no matching activity", () => {
    expect(matchDay(session({ date: "2026-09-20", status: "completed" }), [], TODAY).state).toBe("completed");
  });

  it("pending is an approval state, not a completion one", () => {
    // A pending revision on a future date is still just upcoming.
    expect(matchDay(session({ date: "2026-09-25", status: "pending" }), [], TODAY).state).toBe("upcoming");
  });
});

describe("buildDay and totalsFor", () => {
  it("only counts activities on that date", () => {
    const d = buildDay(TODAY, [session()], [run(), run({ id: "a2", date: "2026-09-21" })], TODAY);
    expect(d.sessions[0]!.completion.actualDistanceM).toBe(5000);
    expect(d.activities).toHaveLength(1);
    expect(d.isToday).toBe(true);
    expect(d.sessions[0]!.label).toBe("Easy run · 5.0 km");
  });

  it("is a rest day only when it has no sessions and no activity", () => {
    const rest = buildDay(TODAY, [], [], TODAY);
    expect(rest.sessions).toEqual([]);
    expect(rest.unplanned.state).toBe("rest");
  });

  it("credits an unplanned run on a day with no sessions", () => {
    const d = buildDay(TODAY, [], [run()], TODAY);
    expect(d.unplanned).toMatchObject({ state: "unplanned", actualDistanceM: 5000 });
  });

  it("rolls a week up, counting rest days as neither planned nor completed", () => {
    const days = [
      buildDay("2026-09-21", [session({ date: "2026-09-21" })], [run({ date: "2026-09-21" })], TODAY),
      buildDay("2026-09-22", [], [], TODAY),
      buildDay("2026-09-23", [session({ id: "s3", date: "2026-09-23", prescription: { distanceKm: 3 } })], [], TODAY),
    ];
    const t = totalsFor(days);
    expect(t.sessionsPlanned).toBe(2);
    expect(t.sessionsCompleted).toBe(1);
    expect(t.plannedDistanceM).toBe(8000);
    expect(t.actualDistanceM).toBe(5000);
  });

  it("counts every session on a day with several", () => {
    const easy = session({ id: "easy", prescription: { distanceKm: 5 } });
    const strides = session({ id: "strides", prescription: { distanceKm: 2 } });
    const d = buildDay(TODAY, [easy, strides], [run({ id: "a1", distance_m: 5000 }), run({ id: "a2", distance_m: 2000 })], TODAY);
    const t = totalsFor([d]);
    expect(t.sessionsPlanned).toBe(2);
    expect(t.sessionsCompleted).toBe(2);
    expect(t.plannedDistanceM).toBe(7000);
    expect(t.actualDistanceM).toBe(7000);
  });
});

function completionOf(day: ReturnType<typeof buildDay>, id: string) {
  return day.sessions.find((s) => s.id === id)!.completion;
}

describe("several planned runs on one day", () => {
  const long = session({ id: "long", prescription: { distanceKm: 10 } });
  const strides = session({ id: "strides", prescription: { distanceKm: 2 } });

  it("gives each planned run the activity closest to its distance, one each", () => {
    const d = buildDay(TODAY, [strides, long], [run({ id: "a-long", distance_m: 10_200 }), run({ id: "a-short", distance_m: 1_900 })], TODAY);

    expect(completionOf(d, "long").activityIds).toEqual(["a-long"]);
    expect(completionOf(d, "strides").activityIds).toEqual(["a-short"]);
    expect(d.unplanned.state).toBe("rest");
  });

  it("does not let one activity count towards two runs", () => {
    const d = buildDay(TODAY, [long, strides], [run({ id: "only", distance_m: 10_000 })], TODAY);

    expect(completionOf(d, "long").state).toBe("completed");
    expect(completionOf(d, "strides").activityIds).toEqual([]);
    expect(completionOf(d, "strides").state).toBe("today");
  });

  it("counts a leftover activity as an unplanned run", () => {
    const d = buildDay(
      TODAY,
      [long, strides],
      [run({ id: "a1", distance_m: 10_000 }), run({ id: "a2", distance_m: 2_000 }), run({ id: "a3", distance_m: 3_000 })],
      TODAY,
    );

    expect(d.unplanned).toMatchObject({ state: "unplanned", actualDistanceM: 3000, activityIds: ["a3"] });
  });

  it("still gives a lone planned run every matching activity", () => {
    const d = buildDay(TODAY, [session()], [run({ id: "a1", distance_m: 3000 }), run({ id: "a2", distance_m: 2500 })], TODAY);

    expect(d.sessions[0]!.completion).toMatchObject({ actualDistanceM: 5500, state: "completed" });
    expect(d.unplanned.state).toBe("rest");
  });
});

describe("sessionForEachActivity", () => {
  it("names the planned run each activity counts towards", () => {
    const long = session({ id: "long", prescription: { distanceKm: 10 } });
    const strides = session({ id: "strides", prescription: { distanceKm: 2 } });

    const matched = sessionForEachActivity([long, strides], [run({ id: "a1", distance_m: 9_800 }), run({ id: "a2", distance_m: 2_100 })]);

    expect(matched.get("a1")?.id).toBe("long");
    expect(matched.get("a2")?.id).toBe("strides");
  });

  it("leaves an activity no run claims out", () => {
    const matched = sessionForEachActivity([session()], [run({ id: "ride", activity_type: "cycling" })]);

    expect(matched.has("ride")).toBe(false);
  });
});
