import { describe, expect, it } from "vitest";
import {
  LAST_WEEK_START,
  PLAN_START_MONDAY,
  RACE_DATE,
  TOTAL_WEEKS,
  weekNumberFor,
  weekStartForNumber,
} from "../planMeta";

describe("weekNumberFor", () => {
  it("places the plan's landmark dates in the right weeks", () => {
    expect(weekNumberFor("2026-09-10")).toBe(1); // week 1, irregular Thursday start
    expect(weekNumberFor("2026-09-12")).toBe(1);
    expect(weekNumberFor("2026-09-14")).toBe(2); // corrected week 2 Monday
    expect(weekNumberFor("2026-09-21")).toBe(3);
    expect(weekNumberFor("2027-03-08")).toBe(27);
    expect(weekNumberFor(RACE_DATE)).toBe(27); // race day shares week 27
  });

  it("still groups the pre-fix Tuesday-anchored dates into the same weeks", () => {
    // Grouping must not depend on the date correction having been applied.
    expect(weekNumberFor("2026-09-15")).toBe(2); // old week-2 Tuesday
    expect(weekNumberFor("2026-09-20")).toBe(2); // old week-2 Sunday
    expect(weekNumberFor("2026-09-22")).toBe(3);
    expect(weekNumberFor("2026-09-27")).toBe(3);
  });

  it("clamps outside the plan rather than returning 0 or 28", () => {
    expect(weekNumberFor("2026-01-01")).toBe(1);
    expect(weekNumberFor("2030-01-01")).toBe(TOTAL_WEEKS);
  });
});

describe("weekStartForNumber", () => {
  it("round-trips with weekNumberFor", () => {
    for (let n = 1; n <= TOTAL_WEEKS; n++) {
      expect(weekNumberFor(weekStartForNumber(n))).toBe(n);
    }
  });

  it("anchors week 1 and the last week", () => {
    expect(weekStartForNumber(1)).toBe(PLAN_START_MONDAY);
    expect(LAST_WEEK_START).toBe("2027-03-08");
  });

  it("clamps out-of-range input", () => {
    expect(weekStartForNumber(0)).toBe(weekStartForNumber(1));
    expect(weekStartForNumber(99)).toBe(LAST_WEEK_START);
  });
});
