import { describe, expect, it } from "vitest";
import { addRow, applyDraft, finishSnapshot, parseDraft, removeRow, toDraft, type DraftSession } from "../strengthDraft";

function row(setIndex: number, over: Partial<{ logged: boolean; reps: number | null; weightKg: number | null }> = {}) {
  return { setIndex, logged: false, reps: 8, holdSeconds: null, weightKg: 40, previous: { reps: 8, holdSeconds: null, weightKg: 40 }, ...over };
}

function session(): DraftSession {
  return {
    groups: [
      {
        superset: false,
        sequence: [],
        exercises: [{ logExerciseId: "a", restSeconds: 90, measure: "reps", rows: [row(0), row(1)] }],
      },
      {
        superset: true,
        sequence: [],
        exercises: [
          { logExerciseId: "b", restSeconds: 60, measure: "reps", rows: [row(0)] },
          { logExerciseId: "c", restSeconds: 120, measure: "hold", rows: [{ setIndex: 0, logged: false, reps: null, holdSeconds: 30, weightKg: null, previous: null }] },
        ],
      },
    ],
  };
}

describe("strength draft", () => {
  it("round-trips through storage and lays back over the server's copy", () => {
    const local = session();
    local.groups[0]!.exercises[0]!.rows[0]!.logged = true;
    local.groups[0]!.exercises[0]!.rows[0]!.weightKg = 42.5;
    addRow(local.groups[0]!, local.groups[0]!.exercises[0]!);

    const restored = applyDraft(session(), parseDraft(JSON.stringify(toDraft(local))));
    const rows = restored.groups[0]!.exercises[0]!.rows;
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ logged: true, weightKg: 42.5, previous: { reps: 8 } });
    expect(rows[2]).toMatchObject({ setIndex: 2, logged: false, previous: null });
    expect(restored.groups[0]!.sequence.map((s) => s.setIndex)).toEqual([0, 1, 2]);
  });

  it("leaves exercises the draft doesn't know as the server has them", () => {
    const restored = applyDraft(session(), { version: 1, exercises: {} });
    expect(restored.groups[1]!.exercises[0]!.rows).toHaveLength(1);
  });

  it("ignores a draft it can't read", () => {
    expect(parseDraft("not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 9, exercises: {} }))).toBeNull();
    expect(parseDraft(null)).toBeNull();
  });

  it("adds a set pre-filled from the last, and re-plans a superset's rounds", () => {
    const s = session();
    const group = s.groups[1]!;
    group.exercises[0]!.rows[0]!.reps = 10;
    addRow(group, group.exercises[0]!);
    expect(group.exercises[0]!.rows[1]).toMatchObject({ reps: 10, weightKg: 40, logged: false });
    expect(group.sequence).toEqual([
      { exercise: 0, setIndex: 0, restAfter: false, restSeconds: 120 },
      { exercise: 1, setIndex: 0, restAfter: true, restSeconds: 120 },
      { exercise: 0, setIndex: 1, restAfter: true, restSeconds: 120 },
    ]);
  });

  it("keeps at least one set", () => {
    const s = session();
    const group = s.groups[1]!;
    removeRow(group, group.exercises[0]!);
    expect(group.exercises[0]!.rows).toHaveLength(1);
  });

  it("sends set counts and only the logged sets on finish", () => {
    const s = session();
    s.groups[0]!.exercises[0]!.rows[1]!.logged = true;
    s.groups[1]!.exercises[1]!.rows[0]!.logged = true;
    expect(finishSnapshot(s)).toEqual({
      exercises: [
        { logExerciseId: "a", sets: 2, logged: [{ setIndex: 1, reps: 8, holdSeconds: null, weightKg: 40 }] },
        { logExerciseId: "b", sets: 1, logged: [] },
        { logExerciseId: "c", sets: 1, logged: [{ setIndex: 0, reps: null, holdSeconds: 30, weightKg: null }] },
      ],
    });
  });
});
