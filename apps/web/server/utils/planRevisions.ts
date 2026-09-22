import { clampWeeklyIncrease, evaluate } from "@fitness/engine";
import { db } from "./db";
import { addDaysIso, isoDate } from "./dates";
import { loadTrainingWindow } from "./trainingData";

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

// The one path that writes to plan_sessions/plan_revisions — used by both the
// MCP propose_revision tool and the deterministic weekly-draft cron. Spec
// Section 5: "model output is clamped by the engine after generation,
// always" — this is where that happens, regardless of what called it.
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
