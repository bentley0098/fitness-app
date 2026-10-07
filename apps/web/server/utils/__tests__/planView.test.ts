import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ db: {} }));

const { buildPlannedSession } = await import("../planView");

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
