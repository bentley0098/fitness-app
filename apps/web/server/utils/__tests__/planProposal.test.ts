import { describe, expect, it } from "vitest";
import { planApply, snapshotOperations, type PlannerSession } from "../planProposal";

// Week of Mon 2026-09-21 .. Sun 2026-09-27.
const WED = "2026-09-23";
const FRI = "2026-09-25";

function session(overrides: Partial<PlannerSession> & { id: string; date: string }): PlannerSession {
  return {
    phase: "base",
    type: "easy_run",
    prescription: { distanceKm: 10, pace: "6:00" },
    cap: {},
    status: "planned",
    revision: 1,
    ...overrides,
  };
}

const thursdayRun = session({ id: "s-thu", date: "2026-09-24" });

describe("update operations", () => {
  it("merges the patch into the prescription and reports weekly volume before and after", () => {
    const ops = snapshotOperations([thursdayRun], [
      { kind: "update", sessionId: "s-thu", patch: { prescription: { distanceKm: 8 } } },
    ]);
    if (!ops.ok) throw new Error(ops.message);

    const plan = planApply([thursdayRun], ops.operations);

    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.after).toEqual([
      expect.objectContaining({ id: "s-thu", prescription: { distanceKm: 8, pace: "6:00" }, revision: 2 }),
    ]);
    expect(plan.volume).toEqual([{ weekStart: "2026-09-21", beforeM: 10_000, afterM: 8_000 }]);
  });
});

describe("update operation refusals", () => {
  const request = (patch: object) => [{ kind: "update" as const, sessionId: "s-thu", patch }];

  it("refuses to change a session's status", () => {
    const ops = snapshotOperations([thursdayRun], request({ status: "completed" }));
    if (!ops.ok) throw new Error(ops.message);

    const plan = planApply([thursdayRun], ops.operations);

    expect(plan).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("refuses when the session changed after the proposal was made", () => {
    const ops = snapshotOperations([thursdayRun], request({ type: "long_run" }));
    if (!ops.ok) throw new Error(ops.message);
    const editedSince = { ...thursdayRun, revision: 2 };

    const plan = planApply([editedSince], ops.operations);

    expect(plan).toEqual({ ok: false, reason: "stale", message: "Plan changed since this was proposed." });
  });

  it("refuses a proposal that targets a session that does not exist", () => {
    const ops = snapshotOperations([thursdayRun], [{ kind: "update", sessionId: "nope", patch: {} }]);

    expect(ops).toMatchObject({ ok: false, reason: "missing" });
  });
});

describe("update operation fields", () => {
  it("stores notes as the prescription note without touching other fields", () => {
    const ops = snapshotOperations([thursdayRun], [
      { kind: "update", sessionId: "s-thu", patch: { notes: "Keep it conversational" } },
    ]);
    if (!ops.ok) throw new Error(ops.message);

    const plan = planApply([thursdayRun], ops.operations);

    expect(plan.ok && plan.after[0].prescription).toEqual({ distanceKm: 10, pace: "6:00", note: "Keep it conversational" });
  });

  it("describes each change as a write the executor can run", () => {
    const ops = snapshotOperations([thursdayRun], [
      { kind: "update", sessionId: "s-thu", patch: { type: "long_run" } },
    ]);
    if (!ops.ok) throw new Error(ops.message);

    const plan = planApply([thursdayRun], ops.operations);

    expect(plan.ok && plan.writes).toEqual([
      {
        kind: "update",
        id: "s-thu",
        fields: { type: "long_run", phase: "base", prescription: { distanceKm: 10, pace: "6:00" }, cap: {}, revision: 2 },
      },
    ]);
  });
});
