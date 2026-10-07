import { db } from "./db";
import { isoDate } from "./dates";
import {
  buildRows,
  groupSlots,
  latestPerExercise,
  targetLabel,
  type Exercise,
  type Kind,
  type LogRow,
  type LoggedSet,
  type TemplateSlot,
} from "./strength";
import { loadExercises } from "./strengthStore";

// The I/O half of the strength log. The rules (pre-fill, rows) live in
// strength.ts; this loads and writes rows.

export class LogError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "LogError";
  }
}

function toLoggedSet(row: Record<string, any>): LoggedSet {
  return { reps: row.reps ?? null, holdSeconds: row.hold_seconds ?? null, weightKg: row.weight_kg ?? null };
}

function toLogSlot(row: Record<string, any>): TemplateSlot {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    sets: row.sets,
    repsMin: row.reps_min ?? null,
    repsMax: row.reps_max ?? null,
    holdSeconds: row.hold_seconds ?? null,
    restSeconds: row.rest_seconds ?? null,
    supersetGroup: row.superset_group ?? null,
    note: row.note ?? null,
  };
}

/**
 * Starts a session from a template, copying its exercises into the log. Starting
 * from a planned session that already has one in progress resumes that one.
 */
export async function startLog(input: { templateId: string; planSessionId?: string | null; date?: string }): Promise<string> {
  if (input.planSessionId) {
    const { data: existing, error } = await db
      .from("strength_logs")
      .select("id")
      .eq("plan_session_id", input.planSessionId)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) throw new Error(`Lookup failed: ${error.message}`);
    if (existing) return existing.id;
  }

  const { data: template, error: tErr } = await db.from("strength_templates").select("*").eq("id", input.templateId).maybeSingle();
  if (tErr) throw new Error(`Load template failed: ${tErr.message}`);
  if (!template) throw new LogError("No such template.", 404);

  const { data: slots, error: sErr } = await db
    .from("strength_template_slots")
    .select("*")
    .eq("template_id", template.id)
    .order("position", { ascending: true });
  if (sErr) throw new Error(`Load template slots failed: ${sErr.message}`);

  const { data: log, error: lErr } = await db
    .from("strength_logs")
    .insert({
      date: input.date ?? isoDate(new Date()),
      kind: template.kind,
      template_id: template.id,
      template_name: template.name,
      plan_session_id: input.planSessionId ?? null,
    })
    .select("id")
    .single();
  if (lErr) throw new Error(`Start session failed: ${lErr.message}`);

  const { error: eErr } = await db.from("strength_log_exercises").insert(
    (slots ?? []).map((s, position) => ({
      log_id: log.id,
      position,
      exercise_id: s.exercise_id,
      sets: s.sets,
      reps_min: s.reps_min,
      reps_max: s.reps_max,
      hold_seconds: s.hold_seconds,
      rest_seconds: s.rest_seconds,
      superset_group: s.superset_group,
      note: s.note,
    })),
  );
  if (eErr) {
    // No transactions on this client: don't leave an empty session behind.
    await db.from("strength_logs").delete().eq("id", log.id);
    throw new Error(`Start session failed: ${eErr.message}`);
  }
  return log.id;
}

export async function activeLog(): Promise<{ id: string; templateName: string; date: string } | null> {
  const { data, error } = await db
    .from("strength_logs")
    .select("id, template_name, date")
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  const row = data?.[0];
  return row ? { id: row.id, templateName: row.template_name, date: row.date } : null;
}

/** For each exercise, the sets from its most recent finished session before this one. */
async function loadPreviousSets(exerciseIds: string[], excludeLogId: string): Promise<Map<string, LoggedSet[]>> {
  const previous = new Map<string, LoggedSet[]>();
  if (exerciseIds.length === 0) return previous;

  const { data: entries, error } = await db
    .from("strength_log_exercises")
    .select("id, log_id, exercise_id")
    .in("exercise_id", exerciseIds)
    .neq("log_id", excludeLogId);
  if (error) throw new Error(`Load history failed: ${error.message}`);
  if (!entries?.length) return previous;

  const { data: logs, error: logErr } = await db
    .from("strength_logs")
    .select("id, date, finished_at")
    .in("id", [...new Set(entries.map((e) => e.log_id))])
    .eq("status", "finished");
  if (logErr) throw new Error(`Load history failed: ${logErr.message}`);

  const logById = new Map((logs ?? []).map((l) => [l.id, l]));
  const latest = latestPerExercise(
    entries
      .filter((e) => logById.has(e.log_id))
      .map((e) => ({
        exerciseId: e.exercise_id,
        logExerciseId: e.id,
        date: logById.get(e.log_id)!.date,
        finishedAt: logById.get(e.log_id)!.finished_at,
      })),
  );
  if (latest.size === 0) return previous;

  const { data: sets, error: setErr } = await db
    .from("strength_log_sets")
    .select("*")
    .in("log_exercise_id", [...latest.values()])
    .order("set_index", { ascending: true });
  if (setErr) throw new Error(`Load history failed: ${setErr.message}`);

  for (const [exerciseId, logExerciseId] of latest) {
    previous.set(
      exerciseId,
      (sets ?? []).filter((s) => s.log_exercise_id === logExerciseId).map(toLoggedSet),
    );
  }
  return previous;
}

export interface LogView {
  id: string;
  date: string;
  kind: Kind;
  templateName: string;
  planSessionId: string | null;
  status: "in_progress" | "finished";
  groups: {
    superset: boolean;
    exercises: {
      logExerciseId: string;
      exerciseId: string;
      name: string;
      measure: Exercise["measure"];
      perSide: boolean;
      note: string | null;
      restSeconds: number | null;
      target: string;
      rows: LogRow[];
    }[];
  }[];
}

export async function viewLog(id: string): Promise<LogView> {
  const { data: log, error } = await db.from("strength_logs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Load session failed: ${error.message}`);
  if (!log) throw new LogError("No such session.", 404);

  const [{ data: entryRows, error: eErr }, library] = await Promise.all([
    db.from("strength_log_exercises").select("*").eq("log_id", id).order("position", { ascending: true }),
    loadExercises(),
  ]);
  if (eErr) throw new Error(`Load session failed: ${eErr.message}`);
  const entries = entryRows ?? [];

  const { data: setRows, error: sErr } = entries.length
    ? await db.from("strength_log_sets").select("*").in("log_exercise_id", entries.map((e) => e.id))
    : { data: [], error: null };
  if (sErr) throw new Error(`Load session failed: ${sErr.message}`);

  const previous = await loadPreviousSets([...new Set(entries.map((e) => e.exercise_id))], id);
  const byId = new Map(library.map((e) => [e.id, e]));

  const slots = entries.map(toLogSlot);
  return {
    id: log.id,
    date: log.date,
    kind: log.kind === "physio" ? "physio" : "gym",
    templateName: log.template_name,
    planSessionId: log.plan_session_id ?? null,
    status: log.status === "finished" ? "finished" : "in_progress",
    groups: groupSlots(slots).map((group) => ({
      superset: group.superset,
      exercises: group.slots.map((slot) => {
        const exercise = byId.get(slot.exerciseId);
        if (!exercise) throw new Error(`Session uses an unknown exercise (${slot.exerciseId}).`);
        const logged = (setRows ?? [])
          .filter((s) => s.log_exercise_id === slot.id)
          .map((s) => ({ setIndex: s.set_index as number, ...toLoggedSet(s) }));
        return {
          logExerciseId: slot.id,
          exerciseId: exercise.id,
          name: exercise.name,
          measure: exercise.measure,
          perSide: exercise.perSide,
          note: [slot.note, exercise.note].filter(Boolean).join(" ") || null,
          restSeconds: slot.restSeconds ?? exercise.restSeconds ?? null,
          target: targetLabel(slot, exercise),
          rows: buildRows(slot, exercise.measure, logged, previous.get(exercise.id) ?? []),
        };
      }),
    })),
  };
}

async function requireOpenEntry(logId: string, logExerciseId: string): Promise<void> {
  const { data: log, error } = await db.from("strength_logs").select("id").eq("id", logId).maybeSingle();
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!log) throw new LogError("No such session.", 404);

  const { data: entry, error: eErr } = await db
    .from("strength_log_exercises")
    .select("id, sets")
    .eq("id", logExerciseId)
    .eq("log_id", logId)
    .maybeSingle();
  if (eErr) throw new Error(`Lookup failed: ${eErr.message}`);
  if (!entry) throw new LogError("That exercise isn't part of this session.", 404);
}

export interface SetInput {
  logExerciseId: string;
  setIndex: number;
  reps?: number | null;
  holdSeconds?: number | null;
  weightKg?: number | null;
}

function cleanNumber(value: unknown, label: string, integer: boolean): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) throw new LogError(`${label} must be a non-negative ${integer ? "whole " : ""}number.`, 400);
  return n;
}

/** Logs a set, or changes one already logged. */
export async function saveSet(logId: string, input: SetInput): Promise<void> {
  if (!Number.isInteger(input.setIndex) || input.setIndex < 0) throw new LogError("setIndex must be a non-negative whole number.", 400);
  await requireOpenEntry(logId, input.logExerciseId);

  const row = {
    log_exercise_id: input.logExerciseId,
    set_index: input.setIndex,
    reps: cleanNumber(input.reps, "Reps", true),
    hold_seconds: cleanNumber(input.holdSeconds, "Hold time", true),
    weight_kg: cleanNumber(input.weightKg, "Weight", false),
    logged_at: new Date().toISOString(),
  };
  const { error } = await db.from("strength_log_sets").upsert(row, { onConflict: "log_exercise_id,set_index" });
  if (error) throw new Error(`Save set failed: ${error.message}`);
}

/** Un-logs a set, leaving its row to be pre-filled again. */
export async function clearSet(logId: string, logExerciseId: string, setIndex: number): Promise<void> {
  await requireOpenEntry(logId, logExerciseId);
  const { error } = await db.from("strength_log_sets").delete().eq("log_exercise_id", logExerciseId).eq("set_index", setIndex);
  if (error) throw new Error(`Clear set failed: ${error.message}`);
}

export async function finishLog(id: string): Promise<void> {
  const { data: log, error } = await db.from("strength_logs").select("id, status").eq("id", id).maybeSingle();
  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!log) throw new LogError("No such session.", 404);
  if (log.status === "finished") return;

  const { error: upErr } = await db
    .from("strength_logs")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", id);
  if (upErr) throw new Error(`Finish failed: ${upErr.message}`);
}
