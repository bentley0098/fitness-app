import { clampWeeklyIncrease, evaluate } from "@fitness/engine";
import { db } from "./db";
import { addDaysIso, isoDate } from "./dates";
import { loadTrainingWindow } from "./trainingData";
import { moveRationale, movedFromLabel, planSessionMove, type MoveOutcome } from "./planMove";

export interface ProposeRevisionInput {
  date: string; // ISO date this session/week targets
  phase: string;
  type: string;
  targetWeeklyVolumeM: number; // unclamped ask — the engine clamps it below
  prescription?: Record<string, unknown>;
  cap?: Record<string, unknown>;
  rationale: string;
}

export interface ProposeRevisionResult {
  planSessionId: string;
  planRevisionId: string;
  verdict: string;
  requestedWeeklyVolumeM: number;
  clampedWeeklyVolumeM: number;
}

async function currentWeeklyVolumeM(): Promise<number> {
  const window = await loadTrainingWindow();
  const asOfDate = isoDate(new Date());
  const weekStart = addDaysIso(asOfDate, -6);
  return window.activities.filter((a) => a.date >= weekStart && a.date <= asOfDate).reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
}

// The engine-driven write path for plan_sessions/plan_revisions — used by both
// the MCP propose_revision tool and the deterministic weekly-draft cron. Spec
// Section 5: "model output is clamped by the engine after generation,
// always" — this is where that happens, regardless of what called it.
//
// moveSession() at the foot of this file is the other writer, and deliberately
// skips the clamp: it only ever shuffles sessions between days inside one ISO
// week, so every week's planned volume comes out exactly as it went in. There
// is nothing for a volume clamp to bound. (The engine never reads
// plan_sessions at all — TrainingWindow carries activities, health metrics and
// params, nothing else — so a move cannot shift a verdict either.) Both live
// in this module so "one place writes plan_sessions" stays true.
export async function proposeRevision(input: ProposeRevisionInput): Promise<ProposeRevisionResult> {
  const window = await loadTrainingWindow();
  const asOfDate = isoDate(new Date());
  const evaluation = evaluate(window, asOfDate);

  const currentVolume = await currentWeeklyVolumeM();
  const clampedWeeklyVolumeM = clampWeeklyIncrease(currentVolume, input.targetWeeklyVolumeM, window.engineParams);

  const { data: existing, error: existingErr } = await db
    .from("plan_sessions")
    .select("id, revision")
    .eq("date", input.date)
    .maybeSingle();
  if (existingErr) throw new Error(`Lookup failed: ${existingErr.message}`);

  const revision = (existing?.revision ?? 0) + 1;
  const prescription = { ...(input.prescription ?? {}), targetWeeklyVolumeM: clampedWeeklyVolumeM };

  const sessionFields = {
    phase: input.phase,
    type: input.type,
    prescription,
    cap: input.cap ?? {},
    status: "pending",
    revision,
    changed_because: input.rationale,
    updated_at: new Date().toISOString(),
  };

  let planSessionId: string;
  if (existing) {
    const { data, error } = await db.from("plan_sessions").update(sessionFields).eq("id", existing.id).select("id").single();
    if (error) throw new Error(`Update failed: ${error.message}`);
    planSessionId = data.id;
  } else {
    const { data, error } = await db
      .from("plan_sessions")
      .insert({ date: input.date, ...sessionFields })
      .select("id")
      .single();
    if (error) throw new Error(`Insert failed: ${error.message}`);
    planSessionId = data.id;
  }

  const { data: revisionRow, error: revError } = await db
    .from("plan_revisions")
    .insert({
      plan_session_id: planSessionId,
      engine_verdict: evaluation.verdict,
      proposed: { ...input, clampedWeeklyVolumeM },
      applied: false,
      rationale: input.rationale,
    })
    .select("id")
    .single();
  if (revError) throw new Error(`Revision insert failed: ${revError.message}`);

  return {
    planSessionId,
    planRevisionId: revisionRow.id,
    verdict: evaluation.verdict,
    requestedWeeklyVolumeM: input.targetWeeklyVolumeM,
    clampedWeeklyVolumeM,
  };
}

// Only ever called after explicit human approval (spec Section 6) — nothing
// in this codebase calls this on its own initiative. The weekly cron only
// ever calls proposeRevision above, never this.
export async function applyRevision(planRevisionId: string): Promise<{ planSessionId: string; applied: true }> {
  const { data: revision, error } = await db.from("plan_revisions").select("*").eq("id", planRevisionId).single();
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (revision.applied) throw new Error("Revision already applied.");

  const { error: revErr } = await db.from("plan_revisions").update({ applied: true }).eq("id", planRevisionId);
  if (revErr) throw new Error(`Apply failed: ${revErr.message}`);

  const { error: sessionErr } = await db
    .from("plan_sessions")
    .update({ status: "planned", updated_at: new Date().toISOString() })
    .eq("id", revision.plan_session_id);
  if (sessionErr) throw new Error(`Session update failed: ${sessionErr.message}`);

  return { planSessionId: revision.plan_session_id, applied: true };
}

/**
 * A refusal that carries the HTTP status the route should answer with, so the
 * endpoint stays a thin translation layer.
 */
export class PlanMoveError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PlanMoveError";
  }
}

export interface MoveSessionResult {
  noop: boolean;
  moved: MoveOutcome | null;
  swapped: MoveOutcome | null;
}

interface SessionRow {
  id: string;
  date: string;
  revision: number | null;
}

/**
 * Move a planned session onto another day of its own week, swapping with
 * whatever is already there.
 *
 * Human-initiated, so unlike proposeRevision() this writes straight through
 * rather than parking the session in `pending` for approval — you dragging the
 * card *is* the approval. It still leaves a plan_revisions row behind, so the
 * audit trail stays complete.
 */
export async function moveSession(sessionId: string, toDate: string): Promise<MoveSessionResult> {
  const { data: session, error: sessionErr } = await db
    .from("plan_sessions")
    .select("id, date, revision")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) throw new PlanMoveError(`Lookup failed: ${sessionErr.message}`, 500);
  if (!session) throw new PlanMoveError("No such session.", 404);

  // Not .maybeSingle(): that throws an opaque error on a pre-existing
  // duplicate, and a duplicate is exactly the state worth naming clearly.
  const { data: occupants, error: occErr } = await db
    .from("plan_sessions")
    .select("id, date, revision")
    .eq("date", toDate);
  if (occErr) throw new PlanMoveError(`Lookup failed: ${occErr.message}`, 500);
  if ((occupants?.length ?? 0) > 1) {
    throw new PlanMoveError(`${toDate} already has more than one session — fix that before moving anything onto it.`, 409);
  }

  const occupant = (occupants?.[0] ?? null) as SessionRow | null;
  const plan = planSessionMove(session as SessionRow, toDate, occupant);
  if (!plan.ok) throw new PlanMoveError(plan.error ?? "That move isn't allowed.", 400);
  if (plan.noop) return { noop: true, moved: null, swapped: null };

  const rows = new Map<string, SessionRow>([[session.id, session as SessionRow]]);
  if (occupant) rows.set(occupant.id, occupant);

  const originalDates = new Map([...rows].map(([id, row]) => [id, row.date]));
  const movedFrom = new Map<string, string>();
  if (plan.moved) movedFrom.set(plan.moved.id, plan.moved.from);
  if (plan.swapped) movedFrom.set(plan.swapped.id, plan.swapped.from);

  const written: string[] = [];
  for (const step of plan.steps) {
    // The last write for each session carries its metadata too, so a swap is
    // three round trips rather than five.
    const fields: Record<string, unknown> = { date: step.date };
    if (step.final) {
      fields.revision = (rows.get(step.id)?.revision ?? 0) + 1;
      fields.changed_because = movedFromLabel(movedFrom.get(step.id) ?? step.date);
      fields.updated_at = new Date().toISOString();
    }

    const { error } = await db.from("plan_sessions").update(fields).eq("id", step.id);
    if (error) {
      await rollbackDates(originalDates, written);
      throw new PlanMoveError(`Move failed partway through and was rolled back: ${error.message}`, 500);
    }
    written.push(step.id);
  }

  const audit = [plan.moved, plan.swapped].filter((m): m is MoveOutcome => m !== null).map((m) => ({
    plan_session_id: m.id,
    // NOT NULL, and documented as progress|hold|regress|stop. A move has no
    // engine verdict, and borrowing the current one would imply the engine
    // drove a change you made by hand.
    engine_verdict: "manual",
    proposed: {
      kind: "manual_move",
      fromDate: m.from,
      toDate: m.to,
      // Each row names the *other* session, so either end of a swap can be
      // traced back to its partner.
      swappedWithSessionId: plan.swapped ? (m.id === plan.swapped.id ? plan.moved!.id : plan.swapped.id) : null,
    },
    applied: true,
    rationale: moveRationale(m.from, m.to),
  }));

  // The dates are already committed; losing the audit row shouldn't fail the
  // move, so this is reported rather than thrown.
  const { error: auditErr } = await db.from("plan_revisions").insert(audit);
  if (auditErr) console.error(`[moveSession] audit insert failed: ${auditErr.message}`);

  return { noop: false, moved: plan.moved, swapped: plan.swapped };
}

/** Best-effort compensation — there are no transactions on this client. */
async function rollbackDates(originalDates: Map<string, string>, written: string[]): Promise<void> {
  for (const id of [...written].reverse()) {
    const date = originalDates.get(id);
    if (!date) continue;
    const { error } = await db.from("plan_sessions").update({ date }).eq("id", id);
    if (error) console.error(`[moveSession] rollback of ${id} to ${date} failed: ${error.message}`);
  }
}
