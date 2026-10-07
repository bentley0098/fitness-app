// Seeds the strength library: the exercises and the four starting routines
// (Gym A, Gym B, Physio: ankle, Physio: hips and core).
//
// Only ever adds what is missing, matched by name ignoring case and spacing, so
// running it again never overwrites a template or exercise you have edited.
//
// Run with: npm run strength:seed
import { db } from "../server/utils/db";
import { exerciseKey } from "../server/utils/strength";
import { planSeed } from "../server/utils/strengthSeed";

async function main() {
  const [{ data: existingExercises, error: exErr }, { data: existingTemplates, error: tErr }] = await Promise.all([
    db.from("exercises").select("id, name"),
    db.from("strength_templates").select("id, name"),
  ]);
  if (exErr) throw new Error(`Load exercises failed: ${exErr.message}`);
  if (tErr) throw new Error(`Load templates failed: ${tErr.message}`);

  const plan = planSeed(
    (existingExercises ?? []).map((e) => e.name),
    (existingTemplates ?? []).map((t) => t.name),
  );

  if (plan.exercises.length > 0) {
    const { error } = await db.from("exercises").insert(
      plan.exercises.map((e) => ({
        name: e.name,
        name_key: exerciseKey(e.name),
        measure: e.measure,
        per_side: e.perSide,
        note: e.note,
        rest_seconds: e.restSeconds,
      })),
    );
    if (error) throw new Error(`Insert exercises failed: ${error.message}`);
  }

  // Re-read so templates can point at exercises that were already there too.
  const { data: library, error: libErr } = await db.from("exercises").select("id, name");
  if (libErr) throw new Error(`Load exercises failed: ${libErr.message}`);
  const idByKey = new Map((library ?? []).map((e) => [exerciseKey(e.name), e.id as string]));

  for (const template of plan.templates) {
    const { data: created, error } = await db
      .from("strength_templates")
      .insert({ name: template.name, name_key: exerciseKey(template.name), kind: template.kind })
      .select("id")
      .single();
    if (error) throw new Error(`Insert template ${template.name} failed: ${error.message}`);

    const { error: slotErr } = await db.from("strength_template_slots").insert(
      template.slots.map((s, position) => ({
        template_id: created.id,
        position,
        exercise_id: idByKey.get(exerciseKey(s.exercise)),
        sets: s.sets,
        reps_min: s.repsMin,
        reps_max: s.repsMax,
        hold_seconds: s.holdSeconds,
        rest_seconds: s.restSeconds,
        superset_group: s.supersetGroup,
        note: s.note,
      })),
    );
    if (slotErr) {
      // No transactions on this client: don't leave a half-built template behind.
      await db.from("strength_templates").delete().eq("id", created.id);
      throw new Error(`Insert slots for ${template.name} failed: ${slotErr.message}`);
    }
  }

  console.log(`Added ${plan.exercises.length} exercise(s) and ${plan.templates.length} template(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
