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
