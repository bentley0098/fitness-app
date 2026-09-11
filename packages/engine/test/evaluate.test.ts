import { describe, expect, it } from "vitest";
import { evaluate } from "../src/index.js";
import { addDays, buildBaseline, defaultParams, setHrvStatus, setMovingTime, setRestingHr } from "./fixtures.js";

const ASOF = "2026-02-01"; // arbitrary, well outside the Italy deload window

describe("evaluate — progression", () => {
  it("progresses on a long steady-clean baseline", () => {
    const { activities, healthMetrics } = buildBaseline(ASOF, 49);
    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, ASOF);
    expect(result.verdict).toBe("progress");
    expect(result.signals.consecutiveCleanWeeks).toBeGreaterThanOrEqual(2);
  });

  it("holds, not progresses, with only one clean week (requires two)", () => {
    const { activities, healthMetrics } = buildBaseline(ASOF, 49);
    // Break the week ending 7 days ago: 2 consecutive unbalanced HRV days
    // trips the red flag for that week only, without touching the most
    // recent week's own 2-day HRV window.
    setHrvStatus(healthMetrics, addDays(ASOF, -7), "unbalanced");
    setHrvStatus(healthMetrics, addDays(ASOF, -8), "unbalanced");

    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, ASOF);
    expect(result.signals.consecutiveCleanWeeks).toBe(1);
    expect(result.verdict).toBe("hold");
  });

  it("holds when there's not yet 14 days of activity history", () => {
    const { activities, healthMetrics } = buildBaseline(ASOF, 5);
    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, ASOF);
    expect(result.signals.workloadRatio).toBeNull();
    expect(result.verdict).toBe("hold");
  });
});

describe("evaluate — stop requires all three signals at once", () => {
  function buildDangerZoneWithBaseline() {
    const { activities, healthMetrics } = buildBaseline(ASOF, 34);
    // Spike the most recent 7 days hard, pushing the acute:chronic ratio
    // into the danger zone while the rest of the chronic window stays baseline.
    for (let i = 0; i <= 6; i++) {
      setMovingTime(activities, addDays(ASOF, -i), 6000);
    }
    return { activities, healthMetrics };
  }

  it("returns stop when workload danger zone + HRV red flag + resting-HR spike all co-occur", () => {
    const { activities, healthMetrics } = buildDangerZoneWithBaseline();
    setHrvStatus(healthMetrics, ASOF, "unbalanced");
    setHrvStatus(healthMetrics, addDays(ASOF, -1), "unbalanced");
    for (let i = 0; i <= 6; i++) setRestingHr(healthMetrics, addDays(ASOF, -i), 60);

    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, ASOF);
    expect(result.signals.workloadRatio).not.toBeNull();
    expect(result.signals.workloadRatio!).toBeGreaterThanOrEqual(defaultParams.workloadRatioDangerZone);
    expect(result.signals.hrvRedFlag).toBe(true);
    expect(result.signals.restingHrSpike).toBe(true);
    expect(result.verdict).toBe("stop");
  });

  it("does NOT stop on workload danger zone alone (HRV and RHR both normal)", () => {
    const { activities, healthMetrics } = buildDangerZoneWithBaseline();
    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, ASOF);
    expect(result.signals.hrvRedFlag).toBe(false);
    expect(result.signals.restingHrSpike).toBe(false);
    expect(result.verdict).toBe("regress");
    expect(result.verdict).not.toBe("stop");
  });

  it("does NOT stop on HRV + RHR alone when workload ratio is not in the danger zone", () => {
    const { activities, healthMetrics } = buildBaseline(ASOF, 34);
    setHrvStatus(healthMetrics, ASOF, "unbalanced");
    setHrvStatus(healthMetrics, addDays(ASOF, -1), "unbalanced");
    for (let i = 0; i <= 6; i++) setRestingHr(healthMetrics, addDays(ASOF, -i), 60);

    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, ASOF);
    expect(result.verdict).not.toBe("stop");
    expect(result.verdict).toBe("hold");
  });
});

describe("evaluate — Italy deload", () => {
  it("holds during the deload window even when everything else looks clean", () => {
    const deloadDate = "2026-09-20";
    const { activities, healthMetrics } = buildBaseline(deloadDate, 29);

    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, deloadDate);
    expect(result.verdict).toBe("hold");
    expect(result.reason).toMatch(/Italy/i);
    expect(result.signals.inItalyDeload).toBe(true);
  });

  it("is not fooled by an otherwise-clean streak — deload wins regardless of consecutive clean weeks", () => {
    const deloadDate = "2026-09-25";
    const { activities, healthMetrics } = buildBaseline(deloadDate, 49);

    const result = evaluate({ activities, healthMetrics, engineParams: defaultParams }, deloadDate);
    expect(result.signals.consecutiveCleanWeeks).toBeGreaterThanOrEqual(2);
    expect(result.verdict).toBe("hold");
  });
});
