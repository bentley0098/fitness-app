import { describe, expect, it } from "vitest";
import { diffSchedule, planStrengthSchedule, type ExistingSeeded } from "../strengthSchedule";

// Wed 2026-10-07 is "today": the week of Mon 2026-10-05.
const TODAY = "2026-10-07";
const RACE = "2027-03-14"; // a Sunday; race week starts Mon 2027-03-08

const phases = (week: string) => (week < "2026-10-12" ? "base" : week < "2027-01-01" ? "build" : "peak");

describe("planStrengthSchedule", () => {
  const schedule = planStrengthSchedule({ today: TODAY, raceDate: RACE, phaseForWeek: phases });
  const on = (date: string) => schedule.filter((s) => s.date === date).map((s) => s.templateName).sort();

  it("puts Gym A on Mondays and Gym B on Fridays", () => {
    expect(on("2026-10-12")).toEqual(["Gym A"]);
    expect(on("2026-10-16")).toEqual(["Gym B"]);
    expect(on("2026-10-13")).toEqual([]);
    expect(on("2026-10-15")).toEqual([]);
  });

  it("never schedules a physio routine", () => {
    expect(schedule.filter((s) => s.type === "strength_physio")).toEqual([]);
    expect(schedule.filter((s) => s.templateName.startsWith("Physio"))).toEqual([]);
  });

  it("starts today, so this week's Friday is in and Monday is out", () => {
    expect(on("2026-10-05")).toEqual([]);
    expect(on("2026-10-07")).toEqual([]);
    expect(schedule[0]!.date).toBe("2026-10-09");
  });

  it("runs through the Sunday before race week and no further", () => {
    expect(on("2027-03-05")).toEqual(["Gym B"]);
    expect(on("2027-03-08")).toEqual([]);
    expect(on("2027-03-12")).toEqual([]);
    expect(schedule[schedule.length - 1]!.date).toBe("2027-03-05");
  });

  it("takes each week's phase from the plan", () => {
    expect(schedule.find((s) => s.date === "2026-10-09")?.phase).toBe("base");
    expect(schedule.find((s) => s.date === "2026-10-12")?.phase).toBe("build");
    expect(schedule.find((s) => s.date === "2027-01-04")?.phase).toBe("peak");
  });

  it("types each session by the template's kind", () => {
    expect(schedule.find((s) => s.templateName === "Gym A")?.type).toBe("strength_gym");
    expect(schedule.find((s) => s.templateName === "Gym B")?.type).toBe("strength_gym");
  });

  it("falls back to the last known phase for a week with no runs", () => {
    const sparse = planStrengthSchedule({ today: TODAY, raceDate: RACE, phaseForWeek: (w) => (w === "2026-10-05" ? "base" : null) });

    expect(sparse.find((s) => s.date === "2026-10-12")?.phase).toBe("base");
  });
});

describe("diffSchedule", () => {
  const desired = planStrengthSchedule({ today: TODAY, raceDate: RACE, phaseForWeek: phases });
  const idOf = (templateName: string) => `id-${templateName}`;
  type Seeded = ExistingSeeded & { templateName: string };
  const seeded = (over: Partial<Seeded> & { date: string; templateName: string }): Seeded => ({
    id: `row-${over.date}-${over.templateName}`,
    templateId: idOf(over.templateName),
    revision: 1,
    hasLog: false,
    ...over,
  });

  it("adds everything on a first run", () => {
    const diff = diffSchedule(desired, [], idOf, TODAY);

    expect(diff.insert).toHaveLength(desired.length);
    expect(diff.deleteIds).toEqual([]);
  });

  it("does nothing on a second run", () => {
    const existing = desired.map((d) => seeded({ date: d.date, templateName: d.templateName }));

    expect(diffSchedule(desired, existing, idOf, TODAY)).toEqual({ insert: [], deleteIds: [] });
  });

  it("removes a seeded session that is no longer scheduled and was never touched", () => {
    const stale = seeded({ date: "2026-10-13", templateName: "Gym A" });

    expect(diffSchedule([], [stale], idOf, TODAY).deleteIds).toEqual([stale.id]);
  });

  it("leaves alone a session you moved or that already has a log, and does not add its replacement", () => {
    const week = desired.filter((d) => d.date >= "2026-10-12" && d.date <= "2026-10-18");
    const existing = week.map((d) => seeded({ date: d.date, templateName: d.templateName }));
    // Gym B was dragged from Friday to Saturday; Gym A has a log started from it.
    const moved = { ...existing.find((e) => e.templateName === "Gym B")!, date: "2026-10-17", revision: 2 };
    const logged = { ...existing.find((e) => e.templateName === "Gym A")!, hasLog: true };
    const others = existing.filter((e) => e.templateName !== "Gym B" && e.templateName !== "Gym A");

    const diff = diffSchedule(week, [...others, moved, logged], idOf, TODAY);

    expect(diff).toEqual({ insert: [], deleteIds: [] });
  });

  it("removes untouched seeded physio sessions but keeps any you moved, edited or logged", () => {
    const untouched = seeded({ date: "2026-10-14", templateName: "Physio: ankle" });
    const moved = seeded({ date: "2026-10-15", templateName: "Physio: ankle", revision: 2 });
    const logged = seeded({ date: "2026-10-18", templateName: "Physio: hips and core", hasLog: true });
    const gym = seeded({ date: "2026-10-12", templateName: "Gym A" });
    const gymB = seeded({ date: "2026-10-16", templateName: "Gym B" });
    const week = desired.filter((d) => d.date >= "2026-10-12" && d.date <= "2026-10-18");

    const diff = diffSchedule(week, [untouched, moved, logged, gym, gymB], idOf, TODAY);

    expect(diff.deleteIds).toEqual([untouched.id]);
    expect(diff.insert).toEqual([]);
  });

  it("never touches past sessions", () => {
    const past = seeded({ date: "2026-10-05", templateName: "Gym A" });

    expect(diffSchedule([], [past], idOf, TODAY).deleteIds).toEqual([]);
  });
});
