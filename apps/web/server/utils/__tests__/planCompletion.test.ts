import { describe, expect, it } from "vitest";
import { buildDay, countsToward, matchDay, matchStrengthActivities, sessionForEachActivity, totalsFor, type SessionLike, type StrengthLogLike } from "../planCompletion";

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

describe("planned strength sessions", () => {
  const gymA = session({ id: "gym-a", type: "strength_gym", prescription: { templateId: "t1", templateName: "Gym A" } });
  const log = (over: Partial<StrengthLogLike> = {}): StrengthLogLike => ({
    id: "log1",
    date: TODAY,
    planSessionId: "gym-a",
    templateName: "Gym A",
    kind: "gym",
    status: "finished",
    ...over,
  });

  it("is completed once the log started from it is finished, with no Garmin activity needed", () => {
    const d = buildDay(TODAY, [gymA], [], TODAY, [log()]);

    expect(d.sessions[0]!.completion).toMatchObject({ state: "completed", logId: "log1" });
  });

  it("is under way while the log started from it is unfinished", () => {
    const d = buildDay(TODAY, [gymA], [], TODAY, [log({ status: "in_progress" })]);

    expect(d.sessions[0]!.completion).toMatchObject({ state: "partial", logId: "log1" });
  });

  it("is due today, upcoming or missed according to the day when nothing was logged", () => {
    expect(buildDay(TODAY, [gymA], [], TODAY, []).sessions[0]!.completion.state).toBe("today");
    expect(buildDay("2026-09-25", [{ ...gymA, date: "2026-09-25" }], [], TODAY, []).sessions[0]!.completion.state).toBe("upcoming");
    expect(buildDay("2026-09-20", [{ ...gymA, date: "2026-09-20" }], [], TODAY, []).sessions[0]!.completion.state).toBe("missed");
  });

  it("is not completed by a log of another session, or by one started from nothing", () => {
    const adHoc = log({ id: "adhoc", planSessionId: null, templateName: "Gym B" });
    const d = buildDay("2026-09-20", [{ ...gymA, date: "2026-09-20" }], [], TODAY, [{ ...adHoc, date: "2026-09-20" }]);

    expect(d.sessions[0]!.completion.state).toBe("missed");
    expect(d.unplannedStrength).toEqual([expect.objectContaining({ id: "adhoc", templateName: "Gym B" })]);
  });

  it("lists a log with no plan link as unplanned, and one linked to a session as planned", () => {
    const d = buildDay(TODAY, [gymA], [], TODAY, [log(), log({ id: "extra", planSessionId: null })]);

    expect(d.unplannedStrength.map((l) => l.id)).toEqual(["extra"]);
  });

  it("counts the log started from it even when it was done on another day", () => {
    const monday = { ...gymA, date: "2026-09-21" };
    const d = buildDay("2026-09-21", [monday], [], TODAY, [log({ date: TODAY })]);

    expect(d.sessions[0]!.completion).toMatchObject({ state: "completed", logId: "log1" });
  });

  it("does not list a log on another day as unplanned here", () => {
    const d = buildDay(TODAY, [], [], TODAY, [log({ date: "2026-09-21", planSessionId: null })]);

    expect(d.unplannedStrength).toEqual([]);
  });

  it("leaves a lone run its activities when a strength session shares the day", () => {
    const d = buildDay(TODAY, [session(), gymA], [run({ id: "a1", distance_m: 3000 }), run({ id: "a2", distance_m: 2500 })], TODAY, []);

    expect(d.sessions.find((s) => s.id === "s1")!.completion).toMatchObject({ actualDistanceM: 5500, state: "completed" });
  });

  it("is counted in its own line, leaving the run totals alone", () => {
    const d = buildDay(TODAY, [session(), gymA], [run()], TODAY, [log()]);
    const t = totalsFor([d]);

    expect(t).toMatchObject({ sessionsPlanned: 1, sessionsCompleted: 1, plannedDistanceM: 5000, actualDistanceM: 5000 });
    expect(t).toMatchObject({ strengthPlanned: 1, strengthCompleted: 1 });
  });

  it("names the planned run each activity counts towards without being confused by strength", () => {
    const matched = sessionForEachActivity([gymA, session()], [run({ id: "a1" })]);

    expect(matched.get("a1")?.id).toBe("s1");
  });
});

describe("matchStrengthActivities", () => {
  const logOn = (id: string, date = TODAY) => ({ id, date, startedAt: `${date}T0${id.slice(-1)}:00:00Z` });
  const lift = (over: Record<string, unknown> = {}) => ({ id: "g1", date: TODAY, activity_type: "strength_training", moving_time_s: 3000, avg_hr: 118, ...over });

  it("gives a session the Garmin strength activity from its day", () => {
    const matched = matchStrengthActivities([logOn("log1")], [lift()]);

    expect(matched.get("log1")).toMatchObject({ id: "g1", moving_time_s: 3000, avg_hr: 118 });
  });

  it("ignores runs and activities from other days", () => {
    const matched = matchStrengthActivities([logOn("log1")], [run(), lift({ id: "g2", date: "2026-09-21" })]);

    expect(matched.size).toBe(0);
  });

  it("gives each activity to one session only, earliest session first", () => {
    const matched = matchStrengthActivities([logOn("log2"), logOn("log1")], [lift()]);

    expect([...matched.keys()]).toEqual(["log1"]);
  });

  it("gives nothing to a session when the watch wasn't worn", () => {
    expect(matchStrengthActivities([logOn("log1")], []).size).toBe(0);
  });
});
