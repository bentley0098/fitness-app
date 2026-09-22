import { describe, expect, it } from "vitest";
import { SENTINEL_DATE, formatMoveDate, moveRationale, movedFromLabel, planSessionMove } from "../planMove";

// Week of Mon 2026-09-21 .. Sun 2026-09-27.
const MON = "2026-09-21";
const WED = "2026-09-23";
const FRI = "2026-09-25";
const SUN = "2026-09-27";
const NEXT_MON = "2026-09-28";

const wed = { id: "s-wed", date: WED };
const fri = { id: "s-fri", date: FRI };

describe("planSessionMove", () => {
  it("moves onto a free day in one write", () => {
    const plan = planSessionMove(wed, FRI, null);

    expect(plan.ok).toBe(true);
    expect(plan.noop).toBe(false);
    expect(plan.steps).toEqual([{ id: "s-wed", date: FRI, final: true }]);
    expect(plan.moved).toEqual({ id: "s-wed", from: WED, to: FRI });
    expect(plan.swapped).toBeNull();
  });

  it("treats a drop on the session's own day as a no-op", () => {
    const plan = planSessionMove(wed, WED, wed);

    expect(plan.ok).toBe(true);
    expect(plan.noop).toBe(true);
    expect(plan.steps).toEqual([]);
    expect(plan.moved).toBeNull();
  });

  it("refuses a move outside the session's own week", () => {
    const plan = planSessionMove(wed, NEXT_MON, null);

    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/within their own week/);
    expect(plan.steps).toEqual([]);
  });

  it("accepts a move to either edge of the same week", () => {
    expect(planSessionMove(wed, MON, null).ok).toBe(true);
    expect(planSessionMove(wed, SUN, null).ok).toBe(true);
  });

  it("refuses anything that isn't a calendar date", () => {
    expect(planSessionMove(wed, "not-a-date", null).ok).toBe(false);
    expect(planSessionMove(wed, "2026-9-3", null).ok).toBe(false);
  });

  it("swaps through the sentinel when the target day is taken", () => {
    const plan = planSessionMove(wed, FRI, fri);

    expect(plan.ok).toBe(true);
    expect(plan.steps).toEqual([
      { id: "s-wed", date: SENTINEL_DATE, final: false },
      { id: "s-fri", date: WED, final: true },
      { id: "s-wed", date: FRI, final: true },
    ]);
    expect(plan.moved).toEqual({ id: "s-wed", from: WED, to: FRI });
    expect(plan.swapped).toEqual({ id: "s-fri", from: FRI, to: WED });
  });

  it("never leaves two sessions on one date, however far a swap gets", () => {
    const plan = planSessionMove(wed, FRI, fri);
    const dates = new Map([
      [wed.id, wed.date],
      [fri.id, fri.date],
    ]);

    // Replay the swap one write at a time, checking the invariant after each.
    for (const step of plan.steps) {
      dates.set(step.id, step.date);
      const live = [...dates.values()].filter((d) => d !== SENTINEL_DATE);
      expect(new Set(live).size).toBe(live.length);
    }

    expect(dates.get(wed.id)).toBe(FRI);
    expect(dates.get(fri.id)).toBe(WED);
  });

  it("does not swap a session with itself when it is its own occupant", () => {
    const plan = planSessionMove(wed, FRI, { id: wed.id, date: WED });

    expect(plan.swapped).toBeNull();
    expect(plan.steps).toEqual([{ id: "s-wed", date: FRI, final: true }]);
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
