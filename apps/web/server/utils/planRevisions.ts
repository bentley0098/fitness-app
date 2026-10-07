import { db } from "./db";
import { moveRationale, movedFromLabel, planSessionMove, type MoveOutcome } from "./planMove";

// moveSession() is the app's own write path for plan_sessions — you dragging a
// card. Claude's changes never come through here: they are stored as proposals
// (planProposals.ts) and only applied when approved in the app.

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
}

interface SessionRow {
  id: string;
  date: string;
  revision: number | null;
}

/**
 * Move a planned session onto another day of its own week. A day can hold any
 * number of sessions, so whatever is already there stays put.
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

  const plan = planSessionMove(session as SessionRow, toDate);
  if (!plan.ok) throw new PlanMoveError(plan.error ?? "That move isn't allowed.", 400);
  if (plan.noop) return { noop: true, moved: null };

  const originalDates = new Map([[session.id, (session as SessionRow).date]]);
  const revisions = new Map([[session.id, (session as SessionRow).revision]]);

  const written: string[] = [];
  for (const step of plan.steps) {
    const fields: Record<string, unknown> = { date: step.date };
    if (step.final) {
      fields.revision = (revisions.get(step.id) ?? 0) + 1;
      fields.changed_because = movedFromLabel(plan.moved?.from ?? step.date);
      fields.updated_at = new Date().toISOString();
    }

    const { error } = await db.from("plan_sessions").update(fields).eq("id", step.id);
    if (error) {
      await rollbackDates(originalDates, written);
      throw new PlanMoveError(`Move failed partway through and was rolled back: ${error.message}`, 500);
    }
    written.push(step.id);
  }

  const audit = [plan.moved].filter((m): m is MoveOutcome => m !== null).map((m) => ({
    plan_session_id: m.id,
    // NOT NULL, and documented as progress|hold|regress|stop. A move has no
    // engine verdict, and borrowing the current one would imply the engine
    // drove a change you made by hand.
    engine_verdict: "manual",
    proposed: { kind: "manual_move", fromDate: m.from, toDate: m.to },
    applied: true,
    rationale: moveRationale(m.from, m.to),
  }));

  // The dates are already committed; losing the audit row shouldn't fail the
  // move, so this is reported rather than thrown.
  const { error: auditErr } = await db.from("plan_revisions").insert(audit);
  if (auditErr) console.error(`[moveSession] audit insert failed: ${auditErr.message}`);

  return { noop: false, moved: plan.moved };
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
