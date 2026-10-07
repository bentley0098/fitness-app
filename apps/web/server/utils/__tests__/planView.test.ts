import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

const { buildPlannedSession, buildWeek } = await import("../planView");

const session = (id: string, date: string, type: string, prescription: Record<string, unknown>) => ({
  id,
  date,
  phase: "base",
  type,
  prescription,
  status: "planned",
});

const snapshot = {
  today: "2026-09-20",
  activities: [],
  strengthLogs: [],
  sessions: [
    session("run1", "2026-09-22", "easy_run", { distanceKm: 5 }),
    session("gym1", "2026-09-22", "strength_gym", { templateId: "t1", templateName: "Gym A" }),
  ],
};

describe("buildPlannedSession", () => {
  it("returns a run with its target distance and the week it belongs to", () => {
    const s = buildPlannedSession(snapshot as any, "run1")!;
    expect(s.typeLabel).toBe("Easy run");
    expect(s.targetDistanceM).toBe(5000);
    expect(s.weekStart).toBe("2026-09-21");
    expect(s.isStrength).toBe(false);
  });

  it("returns a strength session with its template id", () => {
    const s = buildPlannedSession(snapshot as any, "gym1")!;
    expect(s.isStrength).toBe(true);
    expect(s.templateId).toBe("t1");
    expect(s.label).toBe("Gym A");
  });

  it("returns null for an unknown id", () => {
    expect(buildPlannedSession(snapshot as any, "nope")).toBeNull();
  });
});

describe("buildWeek", () => {
  it("reports the first session after the week for a rest day's Next up", () => {
    const later = { ...snapshot, sessions: [...snapshot.sessions, session("run2", "2026-09-30", "long_run", { distanceKm: 12 })] };
    expect(buildWeek(later as any, "2026-09-22").nextAfterWeek).toEqual({ date: "2026-09-30", label: "Long run" });
    expect(buildWeek(snapshot as any, "2026-09-22").nextAfterWeek).toBeNull();
  });

  it("names each session's type", () => {
    const day = buildWeek(snapshot as any, "2026-09-22").days.find((d) => d.date === "2026-09-22")!;
    expect(day.sessions.map((s) => s.typeLabel)).toEqual(["Easy run", "Gym"]);
  });
});
