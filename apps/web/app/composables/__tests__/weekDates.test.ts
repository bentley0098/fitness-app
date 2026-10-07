import { describe, expect, it } from "vitest";
import { weekDatesFrom } from "../weekDates";

describe("weekDatesFrom", () => {
  it("lists Monday to Sunday, across a month boundary", () => {
    expect(weekDatesFrom("2026-09-28")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });
});
