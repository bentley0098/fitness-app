import { describe, expect, it } from "vitest";
import { buildRows, verify } from "../../../scripts/import-barcelona-plan";

// Checked against the headline figures in the plan table, so a transcription
// slip fails here rather than silently becoming the plan being followed.
const rows = buildRows();

function weekOf(monday: string) {
  const end = new Date(`${monday}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const endIso = end.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= monday && r.date <= endIso);
}

function kmIn(monday: string): number {
  return weekOf(monday).reduce((sum, r) => sum + ((r.prescription.distanceKm as number) ?? 0), 0);
}

describe("plan structure", () => {
  it("passes its own verification", () => {
    expect(verify()).toEqual([]);
  });

  it("spans Sept 2026 to race day", () => {
    expect(rows[0]!.date).toBe("2026-09-10");
    expect(rows[rows.length - 1]!.date).toBe("2027-03-14");
  });

  it("ends on the marathon", () => {
    const race = rows[rows.length - 1]!;
    expect(race.type).toBe("marathon");
    expect(race.prescription).toMatchObject({ distanceKm: 42.2, goal: "sub-3:30", pace: "4:58/km" });
  });
});

describe("weekly volumes match the plan table", () => {
  // Monday -> stated weekly total.
  const expected: [string, number][] = [
    ["2026-09-28", 9.5], // wk 4
    ["2026-10-12", 16], // wk 6
    ["2026-11-02", 26], // wk 9
    ["2026-11-09", 21], // wk 10, cutback
    ["2026-11-16", 29], // wk 11, 5th day starts
    ["2026-12-07", 35], // wk 14
    ["2026-12-21", 42], // wk 16, first quality
    ["2027-01-04", 46], // wk 18, MP in long run
    ["2027-01-18", 54], // wk 20
    ["2027-02-01", 58], // wk 22
    ["2027-02-15", 66], // wk 24, peak
    ["2027-02-22", 48], // wk 25, taper
    ["2027-03-01", 36], // wk 26
  ];

  it.each(expected)("week starting %s totals %s km", (monday, total) => {
    expect(kmIn(monday)).toBeCloseTo(total, 3);
  });

  it("race week is 16km plus the race", () => {
    const week = weekOf("2027-03-08");
    const nonRace = week.filter((r) => r.type !== "marathon");
    expect(nonRace.reduce((s, r) => s + (r.prescription.distanceKm as number), 0)).toBe(16);
    expect(week.some((r) => r.type === "marathon")).toBe(true);
    // Saturday rests the legs — no row the day before the race.
    expect(week.some((r) => r.date === "2027-03-13")).toBe(false);
  });
});

describe("peaks and progression", () => {
  it("peaks at a 34km long run", () => {
    const longest = Math.max(...rows.map((r) => (r.prescription.distanceKm as number) ?? 0).filter((n) => n < 42));
    expect(longest).toBe(34);
  });

  it("steps long runs 30 / 32 / 34 through the peak block", () => {
    const peak = rows.filter((r) => r.phase === "peak" && r.type === "long_run");
    expect(peak.map((r) => r.prescription.distanceKm)).toEqual([30, 32, 34]);
  });

  it("peaks at a 66km week", () => {
    const mondays = [...new Set(rows.map((r) => r.date))].map((d) => d);
    const totals = mondays.map((d) => kmIn(d));
    expect(Math.max(...totals.filter((t) => t < 100))).toBeCloseTo(66, 3);
  });
});

describe("the plan's own progression rules", () => {
  it("runs walk/run for weeks 1-2 and continuous from week 3", () => {
    const early = rows.filter((r) => r.date < "2026-09-28");
    expect(early.every((r) => r.type === "walk_run_or_continuous")).toBe(true);
    // Weeks 1-2 are ratio-based, week 3 is continuous with a distance estimate.
    expect(rows.find((r) => r.date === "2026-09-10")!.prescription).toHaveProperty("ratio");
    expect(rows.find((r) => r.date === "2026-09-21")!.prescription).toHaveProperty("approxKm");
  });

  it("dates the completed weeks 1-2 to the days they were actually run", () => {
    const dates = rows.filter((r) => r.date < "2026-09-21").map((r) => r.date);
    expect(dates).toEqual(["2026-09-10", "2026-09-12", "2026-09-17", "2026-09-20"]);
  });

  it("adds the 5th day (Sunday) only from week 11", () => {
    const sundays = rows.filter((r) => new Date(`${r.date}T00:00:00Z`).getUTCDay() === 0 && r.type !== "marathon");
    // Week 2's second run landed on a Sunday; the recurring Sunday run starts wk 11.
    const recurring = sundays.filter((r) => r.date > "2026-09-30");
    expect(recurring[0]!.date).toBe("2026-11-22");
  });

  it("keeps everything easy until the first quality session in week 16", () => {
    const quality = rows.filter((r) => r.type === "quality_run");
    expect(quality[0]!.date).toBe("2026-12-21");
    expect(rows.filter((r) => r.type === "quality_run" && r.date < "2026-12-21")).toHaveLength(0);
  });

  it("puts marathon-pace work in long runs from week 18", () => {
    const mp = rows.filter((r) => typeof r.prescription.note === "string" && (r.prescription.note as string).includes("MP"));
    expect(mp[0]!.date).toBe("2027-01-09"); // week 18 Saturday
  });

  it("has cutback weeks at 10, 13, 17 and 21", () => {
    const cutbackMondays = ["2026-11-09", "2026-11-30", "2026-12-28", "2027-01-25"];
    for (const m of cutbackMondays) {
      expect(weekOf(m).every((r) => r.phase === "cutback")).toBe(true);
    }
  });
});
