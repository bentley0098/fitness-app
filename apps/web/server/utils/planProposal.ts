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
export type OperationRequest =
  | { kind: "update"; sessionId: string; patch: SessionPatch }
  | { kind: "move"; sessionId: string; toDate: string };

/** A stored operation: the request plus the session state it was made against. */
export type Operation = OperationRequest & { expectedRevision: number; sessionDate: string };

export interface WeekVolume {
  weekStart: string;
  beforeM: number;
  afterM: number;
}

export type PlanFailure = { ok: false; reason: "invalid" | "missing" | "stale" | "conflict"; message: string };

export type SnapshotResult = { ok: true; operations: Operation[] } | PlanFailure;

/**
 * Parking date for sessions mid-move. `db` has no transactions, and plan code
 * cannot cope with two sessions on one date (see planMove.ts), so a moved
 * session is parked here first. An interrupted run leaves a session missing
 * from its day rather than duplicated.
 */
export const SENTINEL_DATE = "9999-12-31";

/**
 * A row change for the executor, run in order. Non-final writes are
 * bookkeeping (parking); `final` ones carry the session's new state, with
 * `revision` already the new value.
 */
export interface SessionWrite {
  kind: "update";
  id: string;
  final: boolean;
  fields: Partial<Pick<PlannerSession, "type" | "phase" | "prescription" | "cap" | "revision" | "date">>;
}

export type ApplyPlan = { ok: true; after: PlannerSession[]; writes: SessionWrite[]; volume: WeekVolume[] } | PlanFailure;

const PATCHABLE = new Set(["type", "phase", "prescription", "cap", "notes"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
  };
}

function plannedM(sessions: PlannerSession[], weekStart: string): number {
  return sessions
    .filter((s) => mondayOf(s.date) === weekStart)
    .reduce((sum, s) => sum + (targetDistanceM(s.prescription) ?? 0), 0);
}

/** The sessions the operations would leave behind, or why they can't apply. */
export function planApply(sessions: PlannerSession[], operations: Operation[]): ApplyPlan {
  let working = sessions;
  const referenced = new Map<string, number>();
  for (const op of operations) referenced.set(op.sessionId, (referenced.get(op.sessionId) ?? 0) + 1);

  for (const op of operations) {
    // Staleness is judged against the plan as it is now, not as earlier
    // operations in this same proposal leave it.
    const original = sessions.find((s) => s.id === op.sessionId);
    if (!original) return fail("missing", `No session with id ${op.sessionId}.`);
    if (original.revision !== op.expectedRevision) return fail("stale", "Plan changed since this was proposed.");

    const target = working.find((s) => s.id === op.sessionId)!;

    if (op.kind === "update") {
      const patched = applyPatch(target, op.patch);
      if ("ok" in patched) return patched;
      working = working.map((s) => (s.id === target.id ? patched : s));
    } else {
      if (!ISO_DATE.test(op.toDate)) return fail("invalid", `Not a calendar date: ${op.toDate}`);
      if (op.toDate === target.date) continue;

      // Landing on an occupied day swaps, unless the occupant has an
      // operation of its own — then the final date check decides.
      const occupant = working.find((s) => s.date === op.toDate && s.id !== target.id);
      const swap = occupant && !referenced.has(occupant.id) ? occupant : null;
      working = working.map((s) => {
        if (s.id === target.id) return { ...s, date: op.toDate };
        if (swap && s.id === swap.id) return { ...s, date: target.date };
        return s;
      });
    }
  }

  const dates = new Set<string>();
  for (const s of working) {
    if (dates.has(s.date)) return fail("conflict", `More than one session would land on ${s.date}.`);
    dates.add(s.date);
  }

  const before = new Map(sessions.map((s) => [s.id, s]));
  const changed = working.filter((s) => JSON.stringify({ ...s, revision: 0 }) !== JSON.stringify({ ...before.get(s.id)!, revision: 0 }));
  const after = working.map((s) => (changed.includes(s) ? { ...s, revision: s.revision + 1 } : s));

  // Park every session whose date changes before any of them lands, so a
  // swap never shows two sessions on one day.
  const writes: SessionWrite[] = [];
  const moved = changed.filter((s) => s.date !== before.get(s.id)!.date);
  for (const s of moved) writes.push({ kind: "update", id: s.id, final: false, fields: { date: SENTINEL_DATE } });
  for (const s of after.filter((a) => changed.some((c) => c.id === a.id))) {
    writes.push({
      kind: "update",
      id: s.id,
      final: true,
      fields: { type: s.type, phase: s.phase, prescription: s.prescription, cap: s.cap, revision: s.revision, date: s.date },
    });
  }

  const touchedWeeks = new Set<string>();
  for (const s of changed) {
    touchedWeeks.add(mondayOf(before.get(s.id)!.date));
    touchedWeeks.add(mondayOf(s.date));
  }
  const volume = [...touchedWeeks].sort().map((weekStart) => ({
    weekStart,
    beforeM: plannedM(sessions, weekStart),
    afterM: plannedM(after, weekStart),
  }));

  return { ok: true, after, writes, volume };
}
