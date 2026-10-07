import { mondayOf } from "./planMeta";
import { targetDistanceM, type Prescription } from "./planLabels";

// Pure planning for proposals: what applying a set of operations would do to
// the plan. No I/O — the endpoints and MCP handlers load sessions, call this,
// and execute whatever comes back. That's what makes the awkward parts (stale
// revisions, merges, volume) testable without a database.

export interface PlannerSession {
  id: string;
  date: string;
  phase: string;
  type: string;
  prescription: Prescription;
  cap: Record<string, unknown>;
  status: string;
  revision: number;
}

export interface SessionPatch {
  type?: string;
  phase?: string;
  /** Shallow-merged into the existing prescription. */
  prescription?: Prescription;
  cap?: Record<string, unknown>;
  /** Stored as prescription.note, the key the plan already uses for notes. */
  notes?: string;
}

/** What Claude asks for, before the session state it saw is recorded. */
export type OperationRequest = { kind: "update"; sessionId: string; patch: SessionPatch };

/** A stored operation: the request plus the session state it was made against. */
export type Operation = OperationRequest & { expectedRevision: number; sessionDate: string };

export interface WeekVolume {
  weekStart: string;
  beforeM: number;
  afterM: number;
}

export type PlanFailure = { ok: false; reason: "invalid" | "missing" | "stale" | "conflict"; message: string };

export type SnapshotResult = { ok: true; operations: Operation[] } | PlanFailure;

/** A row change for the executor. `revision` is already the new value. */
export type SessionWrite = {
  kind: "update";
  id: string;
  fields: Pick<PlannerSession, "type" | "phase" | "prescription" | "cap" | "revision">;
};

export type ApplyPlan = { ok: true; after: PlannerSession[]; writes: SessionWrite[]; volume: WeekVolume[] } | PlanFailure;

const PATCHABLE = new Set(["type", "phase", "prescription", "cap", "notes"]);

function fail(reason: PlanFailure["reason"], message: string): PlanFailure {
  return { ok: false, reason, message };
}

/** Records the revision and date each target had when the proposal was made. */
export function snapshotOperations(sessions: PlannerSession[], requests: OperationRequest[]): SnapshotResult {
  const operations: Operation[] = [];
  for (const request of requests) {
    const target = sessions.find((s) => s.id === request.sessionId);
    if (!target) return fail("missing", `No session with id ${request.sessionId}.`);
    operations.push({ ...request, expectedRevision: target.revision, sessionDate: target.date });
  }
  return { ok: true, operations };
}

function applyPatch(session: PlannerSession, patch: SessionPatch): PlannerSession | PlanFailure {
  const illegal = Object.keys(patch).filter((k) => !PATCHABLE.has(k));
  if (illegal.length > 0) return fail("invalid", `Cannot change: ${illegal.join(", ")}.`);

  const prescription = { ...session.prescription, ...(patch.prescription ?? {}) };
  if (patch.notes !== undefined) prescription.note = patch.notes;

  return {
    ...session,
    type: patch.type ?? session.type,
    phase: patch.phase ?? session.phase,
    cap: patch.cap ?? session.cap,
    prescription,
    revision: session.revision + 1,
  };
}

function plannedM(sessions: PlannerSession[], weekStart: string): number {
  return sessions
    .filter((s) => mondayOf(s.date) === weekStart)
    .reduce((sum, s) => sum + (targetDistanceM(s.prescription) ?? 0), 0);
}

/** The sessions the operations would leave behind, or why they can't apply. */
export function planApply(sessions: PlannerSession[], operations: Operation[]): ApplyPlan {
  let after = sessions;
  const writes: SessionWrite[] = [];
  const touchedWeeks = new Set<string>();

  for (const op of operations) {
    const target = after.find((s) => s.id === op.sessionId);
    if (!target) return fail("missing", `No session with id ${op.sessionId}.`);
    if (target.revision !== op.expectedRevision) {
      return fail("stale", "Plan changed since this was proposed.");
    }

    const updated = applyPatch(target, op.patch);
    if ("ok" in updated) return updated;

    writes.push({
      kind: "update",
      id: updated.id,
      fields: {
        type: updated.type,
        phase: updated.phase,
        prescription: updated.prescription,
        cap: updated.cap,
        revision: updated.revision,
      },
    });
    touchedWeeks.add(mondayOf(target.date));
    after = after.map((s) => (s.id === target.id ? updated : s));
  }

  const volume = [...touchedWeeks].sort().map((weekStart) => ({
    weekStart,
    beforeM: plannedM(sessions, weekStart),
    afterM: plannedM(after, weekStart),
  }));

  return { ok: true, after, writes, volume };
}
