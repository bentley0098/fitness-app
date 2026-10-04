import { describe, expect, it } from "vitest";
import { parseMaxMetrics, parseRacePredictions } from "../garminMetrics";

describe("parseMaxMetrics", () => {
  it("prefers the precise VO2 max over the rounded one, keyed by date", () => {
    const out = parseMaxMetrics([
      { generic: { calendarDate: "2026-10-03", vo2MaxPreciseValue: 47.6, vo2MaxValue: 48 } },
    ]);
    expect(out.get("2026-10-03")).toBe(47.6);
  });

  it("falls back to the rounded value, and skips entries with no usable value", () => {
    const out = parseMaxMetrics([
      { generic: { calendarDate: "2026-10-01", vo2MaxValue: 48 } },
      { generic: { calendarDate: "2026-10-02", vo2MaxPreciseValue: null, vo2MaxValue: null } },
      { generic: null },
      { cycling: { vo2MaxValue: 50 } },
    ]);
    expect([...out]).toEqual([["2026-10-01", 48]]);
  });

  it("returns an empty map for a non-array payload", () => {
    expect(parseMaxMetrics(null).size).toBe(0);
    expect(parseMaxMetrics({}).size).toBe(0);
  });
});

describe("parseRacePredictions", () => {
  it("maps Garmin's fields to columns", () => {
    expect(
      parseRacePredictions({
        calendarDate: "2026-10-04",
        time5K: 1508,
        time10K: 3158,
        timeHalfMarathon: 6939,
        timeMarathon: 16188,
      }),
    ).toEqual({ date: "2026-10-04", time_5k_s: 1508, time_10k_s: 3158, time_half_s: 6939, time_marathon_s: 16188 });
  });

  it("returns null when there is no date or no prediction", () => {
    expect(parseRacePredictions({ time5K: 1508 })).toBeNull();
    expect(parseRacePredictions({ calendarDate: "2026-10-04", time5K: 0 })).toBeNull();
    expect(parseRacePredictions(undefined)).toBeNull();
  });
});
