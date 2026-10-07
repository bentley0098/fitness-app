import { evaluate } from "@fitness/engine";
import { db } from "./db";
import { isoDate } from "./dates";
import { sessionLabel, type Prescription } from "./planLabels";
import {
  planApply,
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

  const sessions = await loadPlannerSessions();
  const plan = planApply(sessions, proposal.operations);

  if (!plan.ok) {
    // A stale plan means I changed something after this was proposed. Nothing
    // is written; the proposal is parked so I know to ask again.
    await settle(id, "superseded", plan.message);
    throw new ProposalError(plan.message, 409);
  }

  const originals = new Map(sessions.map((s) => [s.id, s]));
  const written = new Set<string>();
  for (const write of plan.writes) {
    // Parking writes only move the date; the final write carries the new state.
    const fields = write.final
      ? { ...write.fields, changed_because: proposal.rationale, updated_at: new Date().toISOString() }
      : write.fields;
    const { error } = await db.from("plan_sessions").update(fields).eq("id", write.id);
    written.add(write.id);
    if (error) {
      // No transactions on this client — undo what landed so a week is never half-changed.
      for (const doneId of written) {
        const o = originals.get(doneId)!;
        const { error: undoErr } = await db
          .from("plan_sessions")
          .update({ type: o.type, phase: o.phase, prescription: o.prescription, cap: o.cap, revision: o.revision, date: o.date })
          .eq("id", doneId);
        if (undoErr) console.error(`[approveProposal] rollback of ${doneId} failed: ${undoErr.message}`);
      }
      throw new Error(`Apply failed and was rolled back: ${error.message}`);
    }
  }

  const audit = plan.writes
    .filter((w) => w.final)
    .map((w) => ({
      plan_session_id: w.id,
      engine_verdict: proposal.engine_verdict,
      proposed: { kind: "proposal", proposalId: id, fields: w.fields },
      applied: true,
      rationale: proposal.rationale,
    }));
  const { error: auditErr } = await db.from("plan_revisions").insert(audit);
  if (auditErr) console.error(`[approveProposal] audit insert failed: ${auditErr.message}`);

  await settle(id, "applied", null);
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
    const before = byId.get(op.sessionId);
    const after = afterById.get(op.sessionId);
    return {
      kind: op.kind,
      date: op.sessionDate,
      toDate: op.kind === "move" ? op.toDate : null,
      before: before ? sessionLabel(before.type, before.prescription) : null,
      after: after ? sessionLabel(after.type, after.prescription) : null,
    };
  });

  // A move onto an occupied day swaps the other session; show it rather than
  // let it change without a row.
  if (plan.ok) {
    const named = new Set(proposal.operations.map((op) => op.sessionId));
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
    status: proposal.status,
    statusNote: proposal.status_note,
    engineVerdict: proposal.engine_verdict,
    createdAt: proposal.created_at,
    rows,
    volume: plan.ok ? plan.volume : [],
  };
}
