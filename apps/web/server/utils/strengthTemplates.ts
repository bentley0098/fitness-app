import { db } from "./db";
import { exerciseKey, findExercise, validateSlots, type Kind, type Measure, type TemplateSlot } from "./strength";
import { LogError, resolveExercise } from "./strengthLogs";
import { loadExercises, toSlot } from "./strengthStore";

// Creating and editing templates by hand, in the app. The same rules apply to
// a proposal Claude makes (planProposal.ts); this is the runner's own path, so
// it writes straight through.

export interface TemplateSlotInput {
  /** Exercise name. A name that matches nothing creates a new exercise. */
  exercise: string;
  /** Only used when the name is new. */
  measure?: Measure;
  perSide?: boolean;
  sets: number;
  repsMin?: number | null;
  repsMax?: number | null;
  holdSeconds?: number | null;
  restSeconds?: number | null;
  supersetGroup?: number | null;
  note?: string | null;
}

export interface TemplateInput {
  name: string;
  /** Fixed once a template exists. */
  kind?: Kind;
  slots: TemplateSlotInput[];
}

export interface EditableTemplate {
  id: string;
  name: string;
  kind: Kind;
  slots: (Required<Omit<TemplateSlotInput, "exercise">> & { exercise: string; measure: Measure; perSide: boolean })[];
}

export async function loadEditableTemplate(id: string): Promise<EditableTemplate | null> {
  const { data: template, error } = await db.from("strength_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Load template failed: ${error.message}`);
  if (!template) return null;

  const [{ data: rows, error: sErr }, exercises] = await Promise.all([
    db.from("strength_template_slots").select("*").eq("template_id", id).order("position", { ascending: true }),
    loadExercises(),
  ]);
  if (sErr) throw new Error(`Load template failed: ${sErr.message}`);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  return {
    id: template.id,
    name: template.name,
    kind: template.kind === "physio" ? "physio" : "gym",
    slots: (rows ?? []).map((row) => {
      const slot = toSlot(row);
      const exercise = byId.get(slot.exerciseId);
      return {
        exercise: exercise?.name ?? "",
        measure: exercise?.measure ?? "reps",
        perSide: exercise?.perSide ?? false,
        sets: slot.sets,
        repsMin: slot.repsMin,
        repsMax: slot.repsMax,
        holdSeconds: slot.holdSeconds,
        restSeconds: slot.restSeconds,
        supersetGroup: slot.supersetGroup,
        note: slot.note,
      };
    }),
  };
}

/** Creates a template (no id) or replaces an existing one's name and exercises. Returns its id. */
export async function saveTemplate(id: string | null, input: TemplateInput): Promise<string> {
  const name = input.name?.trim().replace(/\s+/g, " ");
  if (!name) throw new LogError("Give the template a name.", 400);
  if (!Array.isArray(input.slots) || input.slots.length === 0) throw new LogError("A template needs at least one exercise.", 400);

  const library = await loadExercises();

  // Check everything against the library as it will be, before creating any
  // exercise a bad template would have left behind.
  const provisional = input.slots.map((slot, i) => {
    if (!slot.exercise?.trim()) throw new LogError(`Exercise ${i + 1} needs a name.`, 400);
    const existing = findExercise(library, slot.exercise);
    return {
      id: existing?.id ?? exerciseKey(slot.exercise),
      name: existing?.name ?? slot.exercise.trim(),
      measure: existing?.measure ?? (slot.measure === "hold" ? "hold" : "reps"),
    };
  });
  const asSlots: TemplateSlot[] = input.slots.map((slot, i) => ({
    id: String(i),
    exerciseId: provisional[i]!.id,
    sets: slot.sets,
    repsMin: slot.repsMin ?? null,
    repsMax: slot.repsMax ?? null,
    holdSeconds: slot.holdSeconds ?? null,
    restSeconds: slot.restSeconds ?? null,
    supersetGroup: slot.supersetGroup ?? null,
    note: slot.note ?? null,
  }));
  const problem = validateSlots(asSlots, provisional);
  if (problem) throw new LogError(problem, 400);

  let kind: Kind;
  if (id) {
    const { data: existing, error } = await db.from("strength_templates").select("id, kind").eq("id", id).maybeSingle();
    if (error) throw new Error(`Lookup failed: ${error.message}`);
    if (!existing) throw new LogError("No such template.", 404);
    kind = existing.kind === "physio" ? "physio" : "gym";
  } else {
    if (input.kind !== "gym" && input.kind !== "physio") throw new LogError("Choose gym or physio.", 400);
    kind = input.kind;
  }

  const exerciseIds: string[] = [];
  for (const slot of input.slots) {
    const exercise = await resolveExercise({ name: slot.exercise, measure: slot.measure, perSide: slot.perSide });
    exerciseIds.push(exercise.id);
  }
  const slotRows = (templateId: string) =>
    input.slots.map((slot, position) => ({
      template_id: templateId,
      position,
      exercise_id: exerciseIds[position],
      sets: slot.sets,
      reps_min: slot.repsMin ?? null,
      reps_max: slot.repsMax ?? null,
      hold_seconds: slot.holdSeconds ?? null,
      rest_seconds: slot.restSeconds ?? null,
      superset_group: slot.supersetGroup ?? null,
      note: slot.note?.trim() || null,
    }));

  const nameTaken = (message: string) => new LogError(message.includes("duplicate") ? `There is already a template called "${name}".` : message, message.includes("duplicate") ? 409 : 500);

  if (!id) {
    const { data, error } = await db
      .from("strength_templates")
      .insert({ name, name_key: exerciseKey(name), kind })
      .select("id")
      .single();
    if (error) throw nameTaken(error.message);

    const { error: slotErr } = await db.from("strength_template_slots").insert(slotRows(data.id));
    if (slotErr) {
      // No transactions on this client: don't leave an empty template behind.
      await db.from("strength_templates").delete().eq("id", data.id);
      throw new Error(`Save template failed: ${slotErr.message}`);
    }
    return data.id;
  }

  const { data: oldSlots, error: oldErr } = await db.from("strength_template_slots").select("*").eq("template_id", id);
  if (oldErr) throw new Error(`Load template failed: ${oldErr.message}`);

  const { error: upErr } = await db
    .from("strength_templates")
    .update({ name, name_key: exerciseKey(name), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (upErr) throw nameTaken(upErr.message);

  const { error: delErr } = await db.from("strength_template_slots").delete().eq("template_id", id);
  if (delErr) throw new Error(`Save template failed: ${delErr.message}`);
  const { error: insErr } = await db.from("strength_template_slots").insert(slotRows(id));
  if (insErr) {
    if (oldSlots?.length) await db.from("strength_template_slots").insert(oldSlots);
    throw new Error(`Save template failed: ${insErr.message}`);
  }
  return id;
}
