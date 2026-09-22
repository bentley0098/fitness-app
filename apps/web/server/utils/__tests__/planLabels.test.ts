import { describe, expect, it } from "vitest";
import { sessionLabel, targetDistanceM, targetDurationS, typeLabel } from "../planLabels";

// The five prescription shapes the import script actually produces.
const DISTANCE = { distanceKm: 5 };
const DISTANCE_NOTE = { distanceKm: 4, note: "shakeout" };
const WALK_RUN = { durationMin: 12, ratio: "2:2" };
const CONTINUOUS = { durationMin: 15, approxKm: 2.5 };
const RACE = { goal: "sub-3:30", pace: "4:58/km" };

describe("sessionLabel", () => {
  it("handles every prescription shape in the plan", () => {
    expect(sessionLabel("easy_run", DISTANCE)).toBe("Easy run · 5.0 km");
    expect(sessionLabel("easy_run", DISTANCE_NOTE)).toBe("Easy run · 4.0 km (shakeout)");
    expect(sessionLabel("walk_run_or_continuous", WALK_RUN)).toBe("Walk/run · 12 min (2:2 run/walk)");
    expect(sessionLabel("walk_run_or_continuous", CONTINUOUS)).toBe("Walk/run · 15 min (~2.5 km)");
    expect(sessionLabel("marathon", RACE)).toBe("Marathon · sub-3:30 (4:58/km)");
  });

  it("describes an engine-drafted weekly volume row as a week total", () => {
    expect(sessionLabel("weekly-target", { targetWeeklyVolumeM: 22000 })).toBe("Weekly target · 22.0 km for the week");
  });

  it("degrades to the type alone rather than throwing on an unknown shape", () => {
    expect(sessionLabel("long_run", {})).toBe("Long run");
    expect(sessionLabel("long_run", null)).toBe("Long run");
    expect(sessionLabel(null, null)).toBe("Session");
  });

  it("humanizes a type it has no mapping for", () => {
    expect(typeLabel("tempo_intervals")).toBe("Tempo intervals");
  });
});

describe("targets", () => {
  it("reads distance from distanceKm or approxKm", () => {
    expect(targetDistanceM(DISTANCE)).toBe(5000);
    expect(targetDistanceM(CONTINUOUS)).toBe(2500);
  });

  it("is null for a duration-only or goal-only prescription", () => {
    expect(targetDistanceM(WALK_RUN)).toBeNull();
    expect(targetDistanceM(RACE)).toBeNull();
  });

  it("reads duration only where one is prescribed", () => {
    expect(targetDurationS(WALK_RUN)).toBe(720);
    expect(targetDurationS(CONTINUOUS)).toBe(900);
    expect(targetDurationS(DISTANCE)).toBeNull();
  });
});
