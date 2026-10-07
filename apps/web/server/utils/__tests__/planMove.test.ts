import { describe, expect, it } from "vitest";
import { formatMoveDate, moveRationale, movedFromLabel, planSessionMove } from "../planMove";

// Week of Mon 2026-09-21 .. Sun 2026-09-27.
const MON = "2026-09-21";
const WED = "2026-09-23";
const FRI = "2026-09-25";
const SUN = "2026-09-27";
const NEXT_MON = "2026-09-28";

const wed = { id: "s-wed", date: WED };

describe("planSessionMove", () => {
  it("moves onto a free day in one write", () => {
    const plan = planSessionMove(wed, FRI);

    expect(plan.ok).toBe(true);
    expect(plan.noop).toBe(false);
    expect(plan.steps).toEqual([{ id: "s-wed", date: FRI, final: true }]);
    expect(plan.moved).toEqual({ id: "s-wed", from: WED, to: FRI });
  });

  it("treats a drop on the session's own day as a no-op", () => {
    const plan = planSessionMove(wed, WED);

    expect(plan.ok).toBe(true);
    expect(plan.noop).toBe(true);
    expect(plan.steps).toEqual([]);
    expect(plan.moved).toBeNull();
  });

  it("refuses a move outside the session's own week", () => {
    const plan = planSessionMove(wed, NEXT_MON);

    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/within their own week/);
    expect(plan.steps).toEqual([]);
  });

  it("accepts a move to either edge of the same week", () => {
    expect(planSessionMove(wed, MON).ok).toBe(true);
    expect(planSessionMove(wed, SUN).ok).toBe(true);
  });

  it("refuses anything that isn't a calendar date", () => {
    expect(planSessionMove(wed, "not-a-date").ok).toBe(false);
    expect(planSessionMove(wed, "2026-9-3").ok).toBe(false);
  });

  it("moves onto a day that is already taken in one write, leaving the other session alone", () => {
    const plan = planSessionMove(wed, FRI);

    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual([{ id: "s-wed", date: FRI, final: true }]);
    expect(plan.moved).toEqual({ id: "s-wed", from: WED, to: FRI });
  });
});

describe("move labels", () => {
  it("formats a date as weekday, day, month", () => {
    expect(formatMoveDate("2026-09-23")).toBe("Wed 23 Sep");
    expect(formatMoveDate("2027-03-14")).toBe("Sun 14 Mar");
    expect(formatMoveDate("2026-01-01")).toBe("Thu 1 Jan");
  });

  it("reads the same regardless of the host timezone", () => {
    const tz = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(formatMoveDate("2026-09-23")).toBe("Wed 23 Sep");
      process.env.TZ = "Pacific/Auckland";
      expect(formatMoveDate("2026-09-23")).toBe("Wed 23 Sep");
    } finally {
      process.env.TZ = tz;
    }
  });

  it("describes the origin for the card and the whole move for the audit row", () => {
    expect(movedFromLabel("2026-09-23")).toBe("Moved from Wed 23 Sep");
    expect(moveRationale("2026-09-23", "2026-09-25")).toBe("Moved from Wed 23 Sep to Fri 25 Sep");
  });
});
