import { describe, expect, it } from "vitest";
import { SENTINEL_DATE, isExpired, planApply, selectSuperseded, snapshotOperations, type Operation, type OperationRequest, type PlannerSession } from "../planProposal";

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
        final: true,
        fields: { type: "long_run", phase: "base", prescription: { distanceKm: 10, pace: "6:00" }, cap: {}, revision: 2, date: "2026-09-24" },
      },
    ]);
  });
});

function plan(sessions: PlannerSession[], requests: OperationRequest[]) {
  const ops = snapshotOperations(sessions, requests);
  if (!ops.ok) throw new Error(ops.message);
  return planApply(sessions, ops.operations);
}

describe("move operations", () => {
  const wed = session({ id: "s-wed", date: WED, prescription: { distanceKm: 5 } });
  const fri = session({ id: "s-fri", date: FRI, prescription: { distanceKm: 8 } });

  it("moves a session into another week and reports volume for both weeks", () => {
    const result = plan([wed, fri], [{ kind: "move", sessionId: "s-wed", toDate: "2026-09-30" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.find((s) => s.id === "s-wed")?.date).toBe("2026-09-30");
    expect(result.volume).toEqual([
      { weekStart: "2026-09-21", beforeM: 13_000, afterM: 8_000 },
      { weekStart: "2026-09-28", beforeM: 0, afterM: 5_000 },
    ]);
  });

  it("swaps with whatever already sits on the target day", () => {
    const result = plan([wed, fri], [{ kind: "move", sessionId: "s-wed", toDate: FRI }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.find((s) => s.id === "s-wed")?.date).toBe(FRI);
    expect(result.after.find((s) => s.id === "s-fri")?.date).toBe(WED);
    expect(result.after.map((s) => s.revision)).toEqual([2, 2]);
  });

  it("never leaves two sessions on one date while the writes run", () => {
    const result = plan([wed, fri], [{ kind: "move", sessionId: "s-wed", toDate: FRI }]);
    if (!result.ok) throw new Error(result.message);

    const dates = new Map([wed, fri].map((s) => [s.id, s.date]));
    for (const w of result.writes) {
      if (w.kind === "update" && w.fields.date) dates.set(w.id, w.fields.date);
      const real = [...dates.values()].filter((d) => d !== SENTINEL_DATE);
      expect(new Set(real).size).toBe(real.length);
    }
    expect(Object.fromEntries(dates)).toEqual({ "s-wed": FRI, "s-fri": WED });
  });

  it("bumps a session's revision once when it is both changed and moved", () => {
    const result = plan([wed], [
      { kind: "update", sessionId: "s-wed", patch: { prescription: { distanceKm: 6 } } },
      { kind: "move", sessionId: "s-wed", toDate: FRI },
    ]);

    expect(result.ok && result.after[0]).toMatchObject({ date: FRI, revision: 2, prescription: { distanceKm: 6 } });
  });

  it("refuses a target that is not a calendar date", () => {
    const result = plan([wed], [{ kind: "move", sessionId: "s-wed", toDate: "next friday" }]);

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("refuses two sessions moved onto the same day", () => {
    const result = plan([wed, fri], [
      { kind: "move", sessionId: "s-wed", toDate: "2026-09-27" },
      { kind: "move", sessionId: "s-fri", toDate: "2026-09-27" },
    ]);

    expect(result).toMatchObject({ ok: false, reason: "conflict" });
  });
});

describe("add and remove operations", () => {
  const wed = session({ id: "s-wed", date: WED, prescription: { distanceKm: 5 } });
  const newRun = { kind: "add" as const, date: FRI, phase: "base", type: "easy_run", prescription: { distanceKm: 4 } };

  it("adds a session on a free day and counts its distance", () => {
    const result = plan([wed], [newRun]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after).toHaveLength(2);
    expect(result.writes).toContainEqual({
      kind: "insert",
      fields: { date: FRI, phase: "base", type: "easy_run", prescription: { distanceKm: 4 }, cap: {}, revision: 1 },
    });
    expect(result.volume).toEqual([{ weekStart: "2026-09-21", beforeM: 5_000, afterM: 9_000 }]);
  });

  it("refuses to add a session on a day that already has one", () => {
    const result = plan([wed], [{ ...newRun, date: WED }]);

    expect(result).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("removes a session and drops its distance from the week", () => {
    const result = plan([wed], [{ kind: "remove", sessionId: "s-wed" }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after).toEqual([]);
    expect(result.writes).toEqual([{ kind: "delete", id: "s-wed" }]);
    expect(result.volume).toEqual([{ weekStart: "2026-09-21", beforeM: 5_000, afterM: 0 }]);
  });

  it("lets a session be removed and another added on the same day", () => {
    const result = plan([wed], [{ kind: "remove", sessionId: "s-wed" }, { ...newRun, date: WED }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = result.writes.map((w) => w.kind);
    expect(order.indexOf("delete")).toBeLessThan(order.indexOf("insert"));
  });

  it("refuses to remove a session that changed since the proposal", () => {
    const ops = snapshotOperations([wed], [{ kind: "remove", sessionId: "s-wed" }]);
    if (!ops.ok) throw new Error(ops.message);

    expect(planApply([{ ...wed, revision: 3 }], ops.operations)).toMatchObject({ ok: false, reason: "stale" });
  });

  it("refuses to change a session the same proposal removes", () => {
    const result = plan([wed], [
      { kind: "remove", sessionId: "s-wed" },
      { kind: "update", sessionId: "s-wed", patch: { type: "long_run" } },
    ]);

    expect(result).toMatchObject({ ok: false, reason: "conflict" });
  });
});

describe("a whole week as one proposal", () => {
  const mon = session({ id: "s-mon", date: "2026-09-21", prescription: { distanceKm: 5 } });
  const wed = session({ id: "s-wed", date: WED, prescription: { distanceKm: 6 } });
  const sun = session({ id: "s-sun", date: "2026-09-27", prescription: { distanceKm: 16 } });

  it("applies mixed operations together and reports the week's volume once", () => {
    const result = plan([mon, wed, sun], [
      { kind: "move", sessionId: "s-wed", toDate: "2026-09-21" },
      { kind: "move", sessionId: "s-mon", toDate: WED },
      { kind: "update", sessionId: "s-sun", patch: { prescription: { distanceKm: 18 } } },
      { kind: "add", date: FRI, phase: "base", type: "easy_run", prescription: { distanceKm: 4 } },
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.after.find((s) => s.id === "s-mon")?.date).toBe(WED);
    expect(result.after.find((s) => s.id === "s-wed")?.date).toBe("2026-09-21");
    expect(result.volume).toEqual([{ weekStart: "2026-09-21", beforeM: 27_000, afterM: 33_000 }]);
  });

  it("applies none of it when one operation is stale", () => {
    const ops = snapshotOperations([mon, wed, sun], [
      { kind: "update", sessionId: "s-mon", patch: { type: "long_run" } },
      { kind: "update", sessionId: "s-sun", patch: { type: "easy_run" } },
    ]);
    if (!ops.ok) throw new Error(ops.message);

    const result = planApply([mon, wed, { ...sun, revision: 2 }], ops.operations);

    expect(result).toMatchObject({ ok: false, reason: "stale" });
  });
});

describe("expiry", () => {
  const op = (sessionDate: string, toDate?: string): Operation =>
    toDate
      ? { kind: "move", sessionId: "s", toDate, expectedRevision: 1, sessionDate }
      : { kind: "remove", sessionId: "s", expectedRevision: 1, sessionDate };

  it("is not expired while every session it touches is today or later", () => {
    expect(isExpired([op("2026-09-25")], "2026-09-25")).toBe(false);
  });

  it("expires once the earliest session it touches is in the past", () => {
    expect(isExpired([op("2026-09-30"), op("2026-09-24")], "2026-09-25")).toBe(true);
  });

  it("counts the date a move lands on as well as the one it leaves", () => {
    expect(isExpired([op("2026-09-30", "2026-09-20")], "2026-09-25")).toBe(true);
  });
});

describe("superseding", () => {
  const pending = (id: string, ...ops: Operation[]) => ({ id, operations: ops });
  const update = (sessionId: string): Operation => ({ kind: "update", sessionId, patch: {}, expectedRevision: 1, sessionDate: WED });

  it("supersedes pending proposals that touch the same session", () => {
    const older = [pending("p1", update("a")), pending("p2", update("b")), pending("p3", update("a"), update("c"))];

    expect(selectSuperseded(older, [update("a")])).toEqual(["p1", "p3"]);
  });

  it("supersedes a pending add on the same day", () => {
    const add = (date: string): Operation => ({ kind: "add", date, phase: "base", type: "easy_run", prescription: {}, sessionDate: date });

    expect(selectSuperseded([pending("p1", add(FRI)), pending("p2", add(WED))], [add(FRI)])).toEqual(["p1"]);
  });
});
