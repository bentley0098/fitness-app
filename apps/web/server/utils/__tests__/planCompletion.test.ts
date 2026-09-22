import { describe, expect, it } from "vitest";
import { buildDay, countsToward, matchDay, totalsFor, type SessionLike } from "../planCompletion";

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
    const d = buildDay(TODAY, session(), [run(), run({ id: "a2", date: "2026-09-21" })], TODAY);
    expect(d.completion.actualDistanceM).toBe(5000);
    expect(d.activities).toHaveLength(1);
    expect(d.isToday).toBe(true);
    expect(d.session?.label).toBe("Easy run · 5.0 km");
  });

  it("rolls a week up, counting rest days as neither planned nor completed", () => {
    const days = [
      buildDay("2026-09-21", session({ date: "2026-09-21" }), [run({ date: "2026-09-21" })], TODAY),
      buildDay("2026-09-22", null, [], TODAY),
      buildDay("2026-09-23", session({ id: "s3", date: "2026-09-23", prescription: { distanceKm: 3 } }), [], TODAY),
    ];
    const t = totalsFor(days);
    expect(t.sessionsPlanned).toBe(2);
    expect(t.sessionsCompleted).toBe(1);
    expect(t.plannedDistanceM).toBe(8000);
    expect(t.actualDistanceM).toBe(5000);
  });
});
