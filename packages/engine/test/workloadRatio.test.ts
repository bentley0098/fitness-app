import { describe, expect, it } from "vitest";
import { computeWorkloadRatio } from "../src/index.js";
import { addDays, buildBaseline } from "./fixtures.js";

const ASOF = "2026-02-01";

describe("computeWorkloadRatio", () => {
  it("returns null with fewer than 14 days of history", () => {
    const { activities } = buildBaseline(ASOF, 10);
    expect(computeWorkloadRatio(activities, ASOF).ratio).toBeNull();
  });

  it("computes acute:chronic ratio correctly on a steady baseline (~1.0)", () => {
    const { activities } = buildBaseline(ASOF, 34);
    const { ratio } = computeWorkloadRatio(activities, ASOF);
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeCloseTo(1.0, 5);
  });

  it("reflects a genuine spike week over an otherwise steady baseline", () => {
    const { activities } = buildBaseline(ASOF, 34);
    for (let i = 0; i <= 6; i++) {
      const day = activities.find((a) => a.date === addDays(ASOF, -i));
      if (day) day.movingTimeS = 6000;
    }
    const { ratio } = computeWorkloadRatio(activities, ASOF);
    expect(ratio!).toBeGreaterThan(1.5);
  });
});
