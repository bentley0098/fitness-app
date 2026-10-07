import { evaluate } from "@fitness/engine";
import { db } from "./db";
import { isoDate } from "./dates";
import { sessionLabel, type Prescription } from "./planLabels";
import {
  isExpired,
  planApply,
  selectSuperseded,
  snapshotOperations,
  type Operation,
  type OperationRequest,
  type PlannerSession,
  type WeekVolume,
} from "./planProposal";
import { loadTrainingWindow } from "./trainingData";

// The I/O half of proposals. All decisions live in planProposal.ts; this
// loads sessions, hands them over, and executes whatever comes back.
//
// The MCP can only call createProposal. Approving and rejecting are exposed
// solely through the app's own endpoints, so Claude has no way to apply a
// change — that is the point of the design, not an oversight.

export class ProposalError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ProposalError";
  }
}

export interface ProposalRow {
  id: string;
  rationale: string;
  operations: Operation[];
  engine_verdict: string;
  status: string;
  status_note: string | null;
  created_at: string;
  decided_at: string | null;
}

function toPlannerSession(row: Record<string, any>): PlannerSession {
  return {
    id: row.id,
    date: row.date,
    phase: row.phase,
    type: row.type,
    prescription: (row.prescription ?? {}) as Prescription,
    cap: (row.cap ?? {}) as Record<string, unknown>,
    status: row.status ?? "planned",
    revision: row.revision ?? 1,
  };
}

export async function loadPlannerSessions(): Promise<PlannerSession[]> {
  const { data, error } = await db.from("plan_sessions").select("*").order("date", { ascending: true });
  if (error) throw new Error(`Load sessions failed: ${error.message}`);
  return (data ?? []).map(toPlannerSession);
}

export interface CreatedProposal {
  proposalId: string;
  verdict: string;
  volume: WeekVolume[];
}

export async function createProposal(requests: OperationRequest[], rationale: string): Promise<CreatedProposal> {
  const sessions = await loadPlannerSessions();

  const snapshot = snapshotOperations(sessions, requests);
  if (!snapshot.ok) throw new ProposalError(snapshot.message, 400);

  // Run it now too, so a proposal that could never apply is refused up front
  // and the volume shown to Claude and to me is the real before/after.
  const plan = planApply(sessions, snapshot.operations);
  if (!plan.ok) throw new ProposalError(plan.message, 400);

  const evaluation = evaluate(await loadTrainingWindow(), isoDate(new Date()));

  const { data, error } = await db
    .from("plan_proposals")
    .insert({ rationale, operations: snapshot.operations, engine_verdict: evaluation.verdict })
    .select("id")
    .single();
  if (error) throw new Error(`Proposal insert failed: ${error.message}`);

  // At most one pending proposal per session: this one replaces any older
  // pending proposal touching the same sessions.
  const { data: pending, error: pendingErr } = await db
    .from("plan_proposals")
    .select("id, operations")
    .eq("status", "pending")
    .neq("id", data.id);
  if (pendingErr) throw new Error(`Supersede lookup failed: ${pendingErr.message}`);
  const replaced = selectSuperseded((pending ?? []) as { id: string; operations: Operation[] }[], snapshot.operations);
  if (replaced.length > 0) {
    const { error: supErr } = await db
      .from("plan_proposals")
      .update({ status: "superseded", status_note: "Replaced by a newer proposal", decided_at: new Date().toISOString() })
      .in("id", replaced);
    if (supErr) throw new Error(`Supersede failed: ${supErr.message}`);
  }

  return { proposalId: data.id, verdict: evaluation.verdict, volume: plan.volume };
}

async function loadProposal(id: string): Promise<ProposalRow> {
  const { data, error } = await db.from("plan_proposals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!data) throw new ProposalError("No such proposal.", 404);
  return data as ProposalRow;
}

async function settle(id: string, status: string, statusNote: string | null): Promise<void> {
  const { error } = await db
    .from("plan_proposals")
    .update({ status, status_note: statusNote, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not mark proposal ${status}: ${error.message}`);
}

export async function rejectProposal(id: string): Promise<void> {
  const proposal = await loadProposal(id);
  if (proposal.status !== "pending") throw new ProposalError(`Proposal is already ${proposal.status}.`, 409);
  await settle(id, "rejected", null);
}

export async function approveProposal(id: string): Promise<void> {
  const proposal = await loadProposal(id);
  if (proposal.status !== "pending") throw new ProposalError(`Proposal is already ${proposal.status}.`, 409);

  if (isExpired(proposal.operations, isoDate(new Date()))) {
    throw new ProposalError("This proposal has expired — a session it touches is already in the past.", 409);
  }

  const sessions = await loadPlannerSessions();
  const plan = planApply(sessions, proposal.operations);

  if (!plan.ok) {
    // A stale plan means I changed something after this was proposed. Nothing
    // is written; the proposal is parked so I know to ask again.
    await settle(id, "superseded", plan.message);
    throw new ProposalError(plan.message, 409);
  }

  const originals = new Map(sessions.map((s) => [s.id, s]));
  const touched = new Set<string>(); // existing sessions a write has reached
  const inserted: { id: string; fields: Record<string, unknown> }[] = [];
  const deleted: string[] = [];

  // No transactions on this client — undo what landed so a week is never
  // half-changed. Best effort, and loud if it can't.
  async function rollback(): Promise<void> {
    for (const row of inserted) {
      const { error } = await db.from("plan_sessions").delete().eq("id", row.id);
      if (error) console.error(`[approveProposal] rollback delete of ${row.id} failed: ${error.message}`);
    }
    for (const doneId of touched) {
      const o = originals.get(doneId)!;
      const row = { id: o.id, date: o.date, phase: o.phase, type: o.type, prescription: o.prescription, cap: o.cap, revision: o.revision, status: o.status };
      const query = deleted.includes(doneId) ? db.from("plan_sessions").insert(row) : db.from("plan_sessions").update(row).eq("id", doneId);
      const { error } = await query;
      if (error) console.error(`[approveProposal] rollback of ${doneId} failed: ${error.message}`);
    }
  }

  const audit: Record<string, unknown>[] = [];
  const auditFor = (planSessionId: string, fields: unknown) => ({
    plan_session_id: planSessionId,
    engine_verdict: proposal.engine_verdict,
    proposed: { kind: "proposal", proposalId: id, fields },
    applied: true,
    rationale: proposal.rationale,
  });
  const now = () => new Date().toISOString();

  for (const write of plan.writes) {
    let error: { message: string } | null = null;

    if (write.kind === "delete") {
      touched.add(write.id);
      ({ error } = await db.from("plan_sessions").delete().eq("id", write.id));
      if (!error) deleted.push(write.id);
    } else if (write.kind === "insert") {
      const row = { ...write.fields, changed_because: proposal.rationale, updated_at: now() };
      const res = await db.from("plan_sessions").insert(row).select("id").single();
      error = res.error ?? (res.data ? null : { message: "Insert returned no row." });
      if (res.data) {
        inserted.push({ id: res.data.id, fields: row });
        audit.push(auditFor(res.data.id, write.fields));
      }
    } else {
      touched.add(write.id);
      // Parking writes only move the date; the final write carries the new state.
      const fields = write.final ? { ...write.fields, changed_because: proposal.rationale, updated_at: now() } : write.fields;
      ({ error } = await db.from("plan_sessions").update(fields).eq("id", write.id));
      if (!error && write.final) audit.push(auditFor(write.id, write.fields));
    }

    if (error) {
      await rollback();
      throw new Error(`Apply failed and was rolled back: ${error.message}`);
    }
  }

  // Removed sessions take their audit rows with them (the FK cascades), so
  // what was removed is kept on the proposal itself.
  if (audit.length > 0) {
    const { error: auditErr } = await db.from("plan_revisions").insert(audit);
    if (auditErr) console.error(`[approveProposal] audit insert failed: ${auditErr.message}`);
  }

  await settle(id, "applied", null);
}

/** Stored status, except a pending proposal whose dates have passed reads as expired. */
function effectiveStatus(p: ProposalRow): string {
  return p.status === "pending" && isExpired(p.operations, isoDate(new Date())) ? "expired" : p.status;
}

/** Proposals still waiting on a decision — what the banner counts. */
export async function listPendingProposals(): Promise<{ id: string; rationale: string; createdAt: string }[]> {
  const { data, error } = await db.from("plan_proposals").select("*").eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw new Error(`Load proposals failed: ${error.message}`);
  return ((data ?? []) as ProposalRow[])
    .filter((p) => effectiveStatus(p) === "pending")
    .map((p) => ({ id: p.id, rationale: p.rationale, createdAt: p.created_at }));
}

export interface ProposalView {
  id: string;
  rationale: string;
  status: string;
  statusNote: string | null;
  engineVerdict: string;
  createdAt: string;
  rows: { kind: string; date: string; toDate: string | null; before: string | null; after: string | null }[];
  volume: WeekVolume[];
}

/** A proposal as the app shows it: before/after per operation, plus weekly volume. */
export async function viewProposal(id: string): Promise<ProposalView> {
  const proposal = await loadProposal(id);
  const sessions = await loadPlannerSessions();
  const plan = planApply(sessions, proposal.operations);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const afterById = plan.ok ? new Map(plan.after.map((s) => [s.id, s])) : new Map<string, PlannerSession>();

  const rows: ProposalView["rows"] = proposal.operations.map((op) => {
    if (op.kind === "add") {
      return { kind: "add", date: op.date, toDate: null, before: null, after: sessionLabel(op.type, op.prescription) };
    }
    const before = byId.get(op.sessionId);
    const after = afterById.get(op.sessionId);
    return {
      kind: op.kind,
      date: op.sessionDate,
      toDate: op.kind === "move" ? op.toDate : null,
      before: before ? sessionLabel(before.type, before.prescription) : null,
      after: op.kind === "remove" ? null : after ? sessionLabel(after.type, after.prescription) : null,
    };
  });

  // A move onto an occupied day swaps the other session; show it rather than
  // let it change without a row.
  if (plan.ok) {
    const named = new Set(proposal.operations.flatMap((op) => (op.kind === "add" ? [] : [op.sessionId])));
    for (const s of plan.after) {
      const was = byId.get(s.id);
      if (!was || named.has(s.id) || was.date === s.date) continue;
      const label = sessionLabel(s.type, s.prescription);
      rows.push({ kind: "swap", date: was.date, toDate: s.date, before: label, after: label });
    }
  }

  return {
    id: proposal.id,
    rationale: proposal.rationale,
    status: effectiveStatus(proposal),
    statusNote: proposal.status_note,
    engineVerdict: proposal.engine_verdict,
    createdAt: proposal.created_at,
    rows,
    volume: plan.ok ? plan.volume : [],
  };
}
