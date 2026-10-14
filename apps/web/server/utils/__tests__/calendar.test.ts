import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZONE,
  addDaysIso,
  daysBetween,
  mondayOf,
  resolveZone,
  today,
  weekDates,
  weekdayIndex,
} from "../../../shared/utils/calendar";

describe("today", () => {
  it("is already tomorrow in Dublin 30 minutes before UTC midnight in summer (IST = UTC+1)", () => {
    const now = new Date("2026-07-10T23:30:00Z");
    expect(today(now, "Europe/Dublin")).toBe("2026-07-11");
  });

  it("is still the same day in Dublin 30 minutes after UTC midnight in winter (GMT = UTC)", () => {
    const now = new Date("2026-12-10T00:30:00Z");
    expect(today(now, "Europe/Dublin")).toBe("2026-12-10");
  });

  it("is the same date in Dublin and UTC shortly after UTC midnight in summer", () => {
    expect(today(new Date("2026-07-11T00:30:00Z"), "Europe/Dublin")).toBe("2026-07-11");
  });

  it("is the previous day in Los Angeles and the next day in Auckland for the same instant", () => {
    const now = new Date("2026-09-10T03:00:00Z");
    expect(today(now, "America/Los_Angeles")).toBe("2026-09-09");
    expect(today(now, "Europe/Dublin")).toBe("2026-09-10");
    expect(today(now, "Pacific/Auckland")).toBe("2026-09-10");
    expect(today(new Date("2026-09-10T13:00:00Z"), "Pacific/Auckland")).toBe("2026-09-11");
  });

  it("follows the Irish clock change on 2026-10-25 (01:00 UTC: IST ends, clocks go back)", () => {
    // 00:30 UTC is 01:30 IST, still the 25th. 23:30 UTC on the 24th is 00:30 IST on the 25th.
    expect(today(new Date("2026-10-24T22:59:00Z"), "Europe/Dublin")).toBe("2026-10-24");
    expect(today(new Date("2026-10-24T23:00:00Z"), "Europe/Dublin")).toBe("2026-10-25");
    // After the change, local midnight is 00:00 UTC.
    expect(today(new Date("2026-10-25T23:59:00Z"), "Europe/Dublin")).toBe("2026-10-25");
    expect(today(new Date("2026-10-26T00:00:00Z"), "Europe/Dublin")).toBe("2026-10-26");
  });

  it("follows the Irish clock change on 2027-03-28 (01:00 UTC: GMT ends, IST starts)", () => {
    expect(today(new Date("2027-03-27T23:59:00Z"), "Europe/Dublin")).toBe("2027-03-27");
    expect(today(new Date("2027-03-28T00:00:00Z"), "Europe/Dublin")).toBe("2027-03-28");
    // After the change, local midnight is 23:00 UTC.
    expect(today(new Date("2027-03-28T22:59:00Z"), "Europe/Dublin")).toBe("2027-03-28");
    expect(today(new Date("2027-03-28T23:00:00Z"), "Europe/Dublin")).toBe("2027-03-29");
  });

  it("defaults to Dublin and ignores the runtime TZ", () => {
    const tz = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Auckland";
      expect(today(new Date("2026-07-10T23:30:00Z"))).toBe("2026-07-11");
      process.env.TZ = "America/Los_Angeles";
      expect(today(new Date("2026-07-10T23:30:00Z"))).toBe("2026-07-11");
    } finally {
      process.env.TZ = tz;
    }
  });

  it("falls back to Dublin for an unrecognised zone", () => {
    expect(today(new Date("2026-07-10T23:30:00Z"), "Not/AZone")).toBe("2026-07-11");
  });
});

describe("resolveZone", () => {
  it("keeps a real zone, and falls back for missing or garbage values", () => {
    expect(resolveZone("America/New_York")).toBe("America/New_York");
    expect(resolveZone(undefined)).toBe(DEFAULT_ZONE);
    expect(resolveZone(null)).toBe(DEFAULT_ZONE);
    expect(resolveZone("")).toBe(DEFAULT_ZONE);
    expect(resolveZone("garbage")).toBe(DEFAULT_ZONE);
  });
});

describe("addDaysIso and daysBetween", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDaysIso("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2026-09-21", -21)).toBe("2026-08-31");
  });

  it("counts whole days, signed, across a clock change", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-10-26", "2026-10-24")).toBe(-2);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
  });
});

describe("mondayOf and weekdayIndex", () => {
  it("returns the date itself for a Monday", () => {
    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
  });

  it("backtracks from mid-week", () => {
    expect(mondayOf("2026-09-22")).toBe("2026-09-21"); // Tue
    expect(mondayOf("2026-09-25")).toBe("2026-09-21"); // Fri
  });

  it("treats Sunday as the END of its week, not the start", () => {
    expect(mondayOf("2026-09-27")).toBe("2026-09-21");
    expect(mondayOf("2027-03-14")).toBe("2027-03-08"); // race day
  });

  it("numbers weekdays Monday = 0 to Sunday = 6", () => {
    expect(weekdayIndex("2026-09-21")).toBe(0);
    expect(weekdayIndex("2026-09-27")).toBe(6);
  });
});

describe("weekDates", () => {
  it("returns seven days Monday-first", () => {
    expect(weekDates("2026-09-24")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("lists Monday to Sunday across a month boundary, from any day of the week", () => {
    const week = [
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ];
    expect(weekDates("2026-09-28")).toEqual(week);
    expect(weekDates("2026-10-04")).toEqual(week);
  });
});
