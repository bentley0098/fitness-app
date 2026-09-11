import { describe, expect, it } from "vitest";
import { clampWeeklyIncrease } from "../src/index.js";
import { defaultParams } from "./fixtures.js";

describe("clampWeeklyIncrease", () => {
  it("rejects a proposal beyond the weekly increase cap, capping it instead", () => {
    // 10% cap on a 10,000m week allows at most 11,000m.
    const clamped = clampWeeklyIncrease(10_000, 15_000, defaultParams);
    expect(clamped).toBe(11_000);
  });

  it("passes through a proposal already within the cap unchanged", () => {
    const clamped = clampWeeklyIncrease(10_000, 10_500, defaultParams);
    expect(clamped).toBe(10_500);
  });

  it("never raises a proposal that's already a decrease", () => {
    const clamped = clampWeeklyIncrease(10_000, 8_000, defaultParams);
    expect(clamped).toBe(8_000);
  });
});
