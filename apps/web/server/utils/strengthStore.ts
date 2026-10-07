import { db } from "./db";
import { groupSlots, targetLabel, type Exercise, type Kind, type TemplateSlot } from "./strength";

// The I/O half of strength work. The rules live in strength.ts; this loads rows
// and shapes them for the app.

export function toExercise(row: Record<string, any>): Exercise {
  return {
    id: row.id,
    name: row.name,
    measure: row.measure === "hold" ? "hold" : "reps",
    perSide: Boolean(row.per_side),
    note: row.note ?? null,
    restSeconds: row.rest_seconds ?? null,
  };
}

export function toSlot(row: Record<string, any>): TemplateSlot {
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

export async function loadExercises(): Promise<Exercise[]> {
  const { data, error } = await db.from("exercises").select("*").order("name", { ascending: true });
  if (error) throw new Error(`Load exercises failed: ${error.message}`);
  return (data ?? []).map(toExercise);
}

export interface TemplateSummary {
  id: string;
  name: string;
  kind: Kind;
  exerciseCount: number;
  setCount: number;
  exerciseNames: string[];
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const [{ data: templates, error }, { data: slots, error: slotErr }, exercises] = await Promise.all([
    db.from("strength_templates").select("*").order("name", { ascending: true }),
    db.from("strength_template_slots").select("*").order("position", { ascending: true }),
    loadExercises(),
  ]);
  if (error) throw new Error(`Load templates failed: ${error.message}`);
  if (slotErr) throw new Error(`Load template slots failed: ${slotErr.message}`);

  const names = new Map(exercises.map((e) => [e.id, e.name]));
  return (templates ?? []).map((t) => {
    const own = (slots ?? []).filter((s) => s.template_id === t.id);
    return {
      id: t.id,
      name: t.name,
      kind: t.kind === "physio" ? "physio" : "gym",
      exerciseCount: own.length,
      setCount: own.reduce((sum, s) => sum + (s.sets ?? 0), 0),
      exerciseNames: own.map((s) => names.get(s.exercise_id) ?? "Unknown exercise"),
    };
  });
}

export interface TemplateView {
  id: string;
  name: string;
  kind: Kind;
  groups: {
    superset: boolean;
    slots: {
      id: string;
      exerciseId: string;
      exercise: string;
      target: string;
      measure: Exercise["measure"];
      perSide: boolean;
      restSeconds: number | null;
      note: string | null;
    }[];
  }[];
}

export async function viewTemplate(id: string): Promise<TemplateView | null> {
  const { data: template, error } = await db.from("strength_templates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Load template failed: ${error.message}`);
  if (!template) return null;

  const [{ data: slotRows, error: slotErr }, exercises] = await Promise.all([
    db.from("strength_template_slots").select("*").eq("template_id", id).order("position", { ascending: true }),
    loadExercises(),
  ]);
  if (slotErr) throw new Error(`Load template slots failed: ${slotErr.message}`);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const slots = (slotRows ?? []).map(toSlot);

  return {
    id: template.id,
    name: template.name,
    kind: template.kind === "physio" ? "physio" : "gym",
    groups: groupSlots(slots).map((g) => ({
      superset: g.superset,
      slots: g.slots.map((slot) => {
        const exercise = byId.get(slot.exerciseId);
        return {
          id: slot.id,
          exerciseId: slot.exerciseId,
          exercise: exercise?.name ?? "Unknown exercise",
          target: exercise ? targetLabel(slot, exercise) : `${slot.sets} sets`,
          measure: exercise?.measure ?? "reps",
          perSide: exercise?.perSide ?? false,
          restSeconds: slot.restSeconds ?? exercise?.restSeconds ?? null,
          // A cue written for this template comes before the exercise's own.
          note: [slot.note, exercise?.note].filter(Boolean).join(" ") || null,
        };
      }),
    })),
  };
}
