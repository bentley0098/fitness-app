import { evaluate } from "@fitness/engine";
import { db } from "./db";
import { isStrengthType, sessionLabel, type Prescription } from "./planLabels";
import {
  isExpired,
  isSessionOperation,
  planApply,
  selectSuperseded,
  snapshotOperations,
  type LibraryWrite,
  type Operation,
  type ApplyPlan,
  type OperationRequest,
  type PlanLibrary,
  type PlannerSession,
  type WeekVolume,
} from "./planProposal";
import { exerciseKey } from "./strength";
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
  preview: ProposalPreview | null;
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

/** The exercises and templates a proposal is judged against. */
export async function loadPlanLibrary(): Promise<PlanLibrary> {
  const [{ data: exercises, error: exErr }, { data: templates, error: tErr }, { data: slots, error: sErr }] = await Promise.all([
    db.from("exercises").select("name, measure"),
    db.from("strength_templates").select("id, name, kind, updated_at"),
    db.from("strength_template_slots").select("template_id"),
  ]);
  // The library is the strength tables'. Until they exist, a proposal about runs
  // is judged against an empty one rather than failing.
  if (exErr || tErr || sErr) {
    console.warn(`[proposals] could not load the strength library: ${(exErr ?? tErr ?? sErr)!.message}`);
    return { exercises: [], templates: [] };
  }
  const counts = new Map<string, number>();
  for (const slot of slots ?? []) counts.set(slot.template_id, (counts.get(slot.template_id) ?? 0) + 1);
  return {
    exercises: (exercises ?? []).map((e) => ({ name: e.name, measure: e.measure === "hold" ? "hold" : "reps" })),
    templates: (templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind === "physio" ? "physio" : "gym",
      updatedAt: t.updated_at,
      exerciseCount: counts.get(t.id) ?? 0,
    })),
  };
}

export interface PreviewRow {
  kind: string;
  /** Null for a change to the exercise library or a template, which has no day. */
  date: string | null;
  toDate: string | null;
  before: string | null;
  after: string | null;
}

export interface ProposalPreview {
  rows: PreviewRow[];
  volume: WeekVolume[];
}

const countLabel = (name: string, n: number) => `${name} · ${n} ${n === 1 ? "exercise" : "exercises"}`;

/** Before/after per operation, plus weekly volume, as the proposal screen shows it. */
function buildPreview(operations: Operation[], sessions: PlannerSession[], plan: Extract<ApplyPlan, { ok: true }>, library: PlanLibrary): ProposalPreview {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const afterById = new Map(plan.after.map((s) => [s.id, s]));

  const rows: PreviewRow[] = operations.map((op): PreviewRow => {
    if (op.kind === "add") {
      return { kind: "add", date: op.date, toDate: null, before: null, after: sessionLabel(op.type, op.prescription) };
    }
    if (op.kind === "addExercise") {
      return { kind: "addExercise", date: null, toDate: null, before: null, after: `New exercise: ${op.name.trim()}` };
    }
    if (op.kind === "createTemplate") {
      return { kind: "createTemplate", date: null, toDate: null, before: null, after: `New ${op.templateKind} template: ${countLabel(op.name.trim(), op.slots.length)}` };
    }
    if (op.kind === "updateTemplate") {
      const current = library.templates.find((t) => t.id === op.templateId);
      const write = plan.libraryWrites.find((w) => w.kind === "updateTemplate" && w.id === op.templateId);
      const slots = write?.kind === "updateTemplate" ? write.slots : undefined;
      const name = (op.name ?? current?.name ?? "Template").trim();
      return {
        kind: "updateTemplate",
        date: null,
        toDate: null,
        before: current ? countLabel(current.name, current.exerciseCount) : null,
        after: countLabel(name, slots?.length ?? current?.exerciseCount ?? 0),
      };
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

  return { rows, volume: plan.volume };
}

export interface CreatedProposal {
  proposalId: string;
  verdict: string;
  volume: WeekVolume[];
}

export async function createProposal(requests: OperationRequest[], rationale: string, today: string): Promise<CreatedProposal> {
  const [sessions, library] = await Promise.all([loadPlannerSessions(), loadPlanLibrary()]);

  const snapshot = snapshotOperations(sessions, requests, library);
  if (!snapshot.ok) throw new ProposalError(snapshot.message, 400);

  // Run it now too, so a proposal that could never apply is refused up front
  // and the volume shown to Claude and to me is the real before/after.
  const plan = planApply(sessions, snapshot.operations, library);
  if (!plan.ok) throw new ProposalError(plan.message, 400);

  const evaluation = evaluate(await loadTrainingWindow(), today);

  const { data, error } = await db
    .from("plan_proposals")
    .insert({
      rationale,
      operations: snapshot.operations,
      engine_verdict: evaluation.verdict,
      // Kept so a decided proposal still reads as it did when it was made,
      // rather than being re-judged against a plan that has moved on.
      preview: buildPreview(snapshot.operations, sessions, plan, library),
    })
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
  if (pendingErr) {
    await discardProposal(data.id);
    throw new Error(`Supersede lookup failed: ${pendingErr.message}`);
  }
  const replaced = selectSuperseded((pending ?? []) as { id: string; operations: Operation[] }[], snapshot.operations);
  if (replaced.length > 0) {
    const { error: supErr } = await db
      .from("plan_proposals")
      .update({ status: "superseded", status_note: "Replaced by a newer proposal", decided_at: new Date().toISOString() })
      .in("id", replaced);
    if (supErr) {
      // Don't leave two pending proposals on one session.
      await discardProposal(data.id);
      throw new Error(`Supersede failed: ${supErr.message}`);
    }
  }

  return { proposalId: data.id, verdict: evaluation.verdict, volume: plan.volume };
}

async function discardProposal(id: string): Promise<void> {
  const { error } = await db.from("plan_proposals").delete().eq("id", id);
  if (error) console.error(`[createProposal] could not discard proposal ${id}: ${error.message}`);
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

export async function approveProposal(id: string, today: string): Promise<void> {
  const proposal = await loadProposal(id);
  if (proposal.status !== "pending") throw new ProposalError(`Proposal is already ${proposal.status}.`, 409);

  if (isExpired(proposal.operations, today)) {
    throw new ProposalError("This proposal has expired — a session it touches is already in the past.", 409);
  }

  const [sessions, library] = await Promise.all([loadPlannerSessions(), loadPlanLibrary()]);
  const plan = planApply(sessions, proposal.operations, library);

  if (!plan.ok) {
    // A stale plan means I changed something after this was proposed. Nothing
    // is written; the proposal is parked so I know to ask again. Any other
    // refusal leaves it pending, with the reason in the response.
    if (plan.reason === "stale") await settle(id, "superseded", plan.message);
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
    // Library changes come off last: sessions pointing at a new template are gone by now.
    for (const undoStep of [...undo].reverse()) {
      try {
        await undoStep();
      } catch (e) {
        console.error(`[approveProposal] rollback of a library change failed: ${(e as Error).message}`);
      }
    }
  }

  const undo: (() => Promise<void>)[] = [];
  try {
    await applyLibraryWrites(plan.libraryWrites, undo);
  } catch (e) {
    await rollback();
    throw new Error(`Apply failed and was rolled back: ${(e as Error).message}`);
  }
  const templateIds = await templateIdsByKey();

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
      const row = { ...write.fields, prescription: withTemplateId(write.fields.type, write.fields.prescription, templateIds), changed_because: proposal.rationale, updated_at: now() };
      const res = await db.from("plan_sessions").insert(row).select("id").single();
      error = res.error ?? (res.data ? null : { message: "Insert returned no row." });
      if (res.data) {
        inserted.push({ id: res.data.id, fields: row });
        audit.push(auditFor(res.data.id, write.fields));
      }
    } else {
      touched.add(write.id);
      // Parking writes only move the date; the final write carries the new state.
      const fields = write.final
        ? {
            ...write.fields,
            ...(write.fields.prescription
              ? { prescription: withTemplateId(write.fields.type ?? originals.get(write.id)?.type ?? "", write.fields.prescription, templateIds) }
              : {}),
            changed_because: proposal.rationale,
            updated_at: now(),
          }
        : write.fields;
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
    if (auditErr) {
      await rollback();
      throw new Error(`Apply failed and was rolled back: audit insert failed: ${auditErr.message}`);
    }
  }

  await settle(id, "applied", null);
}

/** Stored status, except a pending proposal whose dates have passed reads as expired. */
function effectiveStatus(p: ProposalRow, today: string): string {
  return p.status === "pending" && isExpired(p.operations, today) ? "expired" : p.status;
}

/** Proposals still waiting on a decision — what the banner counts. */
export async function listPendingProposals(today: string): Promise<{ id: string; rationale: string; createdAt: string }[]> {
  const { data, error } = await db.from("plan_proposals").select("*").eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw new Error(`Load proposals failed: ${error.message}`);
  return ((data ?? []) as ProposalRow[])
    .filter((p) => effectiveStatus(p, today) === "pending")
    .map((p) => ({ id: p.id, rationale: p.rationale, createdAt: p.created_at }));
}

/** Pending proposal ids touching each session, for reads that should show what is already on the table. */
export async function pendingProposalIdsBySession(today: string): Promise<Map<string, string[]>> {
  const { data, error } = await db.from("plan_proposals").select("*").eq("status", "pending");
  if (error) throw new Error(`Load proposals failed: ${error.message}`);
  const bySession = new Map<string, string[]>();
  for (const p of (data ?? []) as ProposalRow[]) {
    if (effectiveStatus(p, today) !== "pending") continue;
    for (const op of p.operations) {
      if (!isSessionOperation(op)) continue;
      bySession.set(op.sessionId, [...(bySession.get(op.sessionId) ?? []), p.id]);
    }
  }
  return bySession;
}

/** The most recent decided or expired proposals, for the history list. */
export async function listRecentProposals(today: string, limit = 20): Promise<{ id: string; rationale: string; status: string; createdAt: string }[]> {
  const { data, error } = await db.from("plan_proposals").select("*").order("created_at", { ascending: false }).limit(limit * 2);
  if (error) throw new Error(`Load proposals failed: ${error.message}`);
  return ((data ?? []) as ProposalRow[])
    .map((p) => ({ id: p.id, rationale: p.rationale, status: effectiveStatus(p, today), createdAt: p.created_at }))
    .filter((p) => p.status !== "pending")
    .slice(0, limit);
}

export interface ProposalView {
  id: string;
  rationale: string;
  status: string;
  statusNote: string | null;
  engineVerdict: string;
  createdAt: string;
  rows: PreviewRow[];
  volume: WeekVolume[];
}

/**
 * A proposal as the app shows it. A pending one is judged against the plan as
 * it is now; every other state shows the preview stored when it was made, so
 * an applied or rejected proposal still reads as it was proposed.
 */
export async function viewProposal(id: string, today: string): Promise<ProposalView> {
  const proposal = await loadProposal(id);

  let preview: ProposalPreview = proposal.preview ?? { rows: [], volume: [] };
  if (proposal.status === "pending") {
    const [sessions, library] = await Promise.all([loadPlannerSessions(), loadPlanLibrary()]);
    const plan = planApply(sessions, proposal.operations, library);
    if (plan.ok) preview = buildPreview(proposal.operations, sessions, plan, library);
  }

  return {
    id: proposal.id,
    rationale: proposal.rationale,
    status: effectiveStatus(proposal, today),
    statusNote: proposal.status_note,
    engineVerdict: proposal.engine_verdict,
    createdAt: proposal.created_at,
    rows: preview.rows,
    volume: preview.volume,
  };
}

async function templateIdsByKey(): Promise<Map<string, string>> {
  const { data, error } = await db.from("strength_templates").select("id, name");
  if (error) throw new Error(`Load templates failed: ${error.message}`);
  return new Map((data ?? []).map((t) => [exerciseKey(t.name), t.id as string]));
}

/** Points a strength session at its template by id; the name it was proposed with is kept alongside. */
function withTemplateId(type: string, prescription: Prescription, templateIds: Map<string, string>): Prescription {
  if (!isStrengthType(type) || typeof prescription.templateName !== "string") return prescription;
  const templateId = templateIds.get(exerciseKey(prescription.templateName));
  return templateId ? { ...prescription, templateId } : prescription;
}

/**
 * Runs the library changes, registering how to take each back. There are no
 * transactions on this client, so approval undoes them if anything after fails.
 */
async function applyLibraryWrites(writes: LibraryWrite[], undo: (() => Promise<void>)[]): Promise<void> {
  const exerciseIds = async () => {
    const { data, error } = await db.from("exercises").select("id, name");
    if (error) throw new Error(`Load exercises failed: ${error.message}`);
    return new Map((data ?? []).map((e) => [exerciseKey(e.name), e.id as string]));
  };
  const slotRows = async (templateId: string, slots: { exercise: string; sets: number; repsMin: number | null; repsMax: number | null; holdSeconds: number | null; restSeconds: number | null; supersetGroup: number | null; note: string | null }[]) => {
    const ids = await exerciseIds();
    return slots.map((slot, position) => {
      const exerciseId = ids.get(exerciseKey(slot.exercise));
      if (!exerciseId) throw new Error(`No exercise called ${slot.exercise}.`);
      return {
        template_id: templateId,
        position,
        exercise_id: exerciseId,
        sets: slot.sets,
        reps_min: slot.repsMin,
        reps_max: slot.repsMax,
        hold_seconds: slot.holdSeconds,
        rest_seconds: slot.restSeconds,
        superset_group: slot.supersetGroup,
        note: slot.note,
      };
    });
  };

  for (const write of writes) {
    if (write.kind === "addExercise") {
      const { data, error } = await db
        .from("exercises")
        .insert({ name: write.name, name_key: exerciseKey(write.name), measure: write.measure, per_side: write.perSide, note: write.note, rest_seconds: write.restSeconds })
        .select("id")
        .single();
      if (error) throw new Error(`Add exercise ${write.name} failed: ${error.message}`);
      undo.push(async () => {
        await db.from("exercises").delete().eq("id", data.id);
      });
    } else if (write.kind === "createTemplate") {
      const { data, error } = await db
        .from("strength_templates")
        .insert({ name: write.name, name_key: exerciseKey(write.name), kind: write.templateKind })
        .select("id")
        .single();
      if (error) throw new Error(`Create template ${write.name} failed: ${error.message}`);
      // Deleting the template takes its slots with it.
      undo.push(async () => {
        await db.from("strength_templates").delete().eq("id", data.id);
      });
      const { error: slotErr } = await db.from("strength_template_slots").insert(await slotRows(data.id, write.slots));
      if (slotErr) throw new Error(`Create template ${write.name} failed: ${slotErr.message}`);
    } else {
      const { data: old, error } = await db.from("strength_templates").select("*").eq("id", write.id).single();
      if (error) throw new Error(`Load template failed: ${error.message}`);
      const { data: oldSlots, error: oldErr } = await db.from("strength_template_slots").select("*").eq("template_id", write.id);
      if (oldErr) throw new Error(`Load template failed: ${oldErr.message}`);

      undo.push(async () => {
        await db.from("strength_templates").update({ name: old.name, name_key: old.name_key, updated_at: old.updated_at }).eq("id", write.id);
        if (write.slots) {
          await db.from("strength_template_slots").delete().eq("template_id", write.id);
          if (oldSlots?.length) await db.from("strength_template_slots").insert(oldSlots);
        }
      });

      const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (write.name !== undefined) {
        fields.name = write.name;
        fields.name_key = exerciseKey(write.name);
      }
      const { error: upErr } = await db.from("strength_templates").update(fields).eq("id", write.id);
      if (upErr) throw new Error(`Update template failed: ${upErr.message}`);

      if (write.slots) {
        const { error: delErr } = await db.from("strength_template_slots").delete().eq("template_id", write.id);
        if (delErr) throw new Error(`Update template failed: ${delErr.message}`);
        const { error: insErr } = await db.from("strength_template_slots").insert(await slotRows(write.id, write.slots));
        if (insErr) throw new Error(`Update template failed: ${insErr.message}`);
      }
    }
  }
}
