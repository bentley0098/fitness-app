// Seeds the strength library: the exercises and the four starting routines
// (Gym A, Gym B, Physio: ankle, Physio: hips and core).
//
// Only ever adds what is missing, matched by name ignoring case and spacing, so
// running it again never overwrites a template or exercise you have edited.
//
// It also schedules the routines in the plan (Gym A and the ankle routine on
// Mondays, the ankle routine on Wednesdays, Gym B on Fridays, hips and core on
// Sundays), from today through the Sunday before race week. A re-run replaces
// only the sessions it created and you have not touched: anything you moved,
// edited or logged stays.
//
// Run with: npm run strength:seed
import { db, withJwtRetry } from "../server/utils/db";
import { isoDate } from "../server/utils/dates";
import { RACE_DATE, mondayOf } from "../server/utils/planMeta";
import { isStrengthType } from "../server/utils/planLabels";
import { exerciseKey } from "../server/utils/strength";
import { planSeed } from "../server/utils/strengthSeed";
import { SEED_MARKER, diffSchedule, planStrengthSchedule } from "../server/utils/strengthSchedule";

async function main() {
  const [{ data: existingExercises, error: exErr }, { data: existingTemplates, error: tErr }] = await Promise.all([
    withJwtRetry(() => db.from("exercises").select("id, name")),
    withJwtRetry(() => db.from("strength_templates").select("id, name")),
  ]);
  if (exErr) throw new Error(`Load exercises failed: ${exErr.message}`);
  if (tErr) throw new Error(`Load templates failed: ${tErr.message}`);

  const plan = planSeed(
    (existingExercises ?? []).map((e) => e.name),
    (existingTemplates ?? []).map((t) => t.name),
  );

  if (plan.exercises.length > 0) {
    const { error } = await withJwtRetry(() => db.from("exercises").insert(
      plan.exercises.map((e) => ({
        name: e.name,
        name_key: exerciseKey(e.name),
        measure: e.measure,
        per_side: e.perSide,
        note: e.note,
        rest_seconds: e.restSeconds,
      })),
    ));
    if (error) throw new Error(`Insert exercises failed: ${error.message}`);
  }

  // Re-read so templates can point at exercises that were already there too.
  const { data: library, error: libErr } = await withJwtRetry(() => db.from("exercises").select("id, name"));
  if (libErr) throw new Error(`Load exercises failed: ${libErr.message}`);
  const idByKey = new Map((library ?? []).map((e) => [exerciseKey(e.name), e.id as string]));

  for (const template of plan.templates) {
    const { data: created, error } = await withJwtRetry(() => db
      .from("strength_templates")
      .insert({ name: template.name, name_key: exerciseKey(template.name), kind: template.kind })
      .select("id")
      .single());
    if (error) throw new Error(`Insert template ${template.name} failed: ${error.message}`);

    const { error: slotErr } = await withJwtRetry(() => db.from("strength_template_slots").insert(
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
    ));
    if (slotErr) {
      // No transactions on this client: don't leave a half-built template behind.
      await withJwtRetry(() => db.from("strength_templates").delete().eq("id", created.id));
      throw new Error(`Insert slots for ${template.name} failed: ${slotErr.message}`);
    }
  }

  console.log(`Added ${plan.exercises.length} exercise(s) and ${plan.templates.length} template(s).`);

  await schedule();
}

async function schedule() {
  const today = isoDate(new Date());

  const [{ data: templates, error: tErr }, { data: sessions, error: sErr }, { data: logs, error: lErr }] = await Promise.all([
    withJwtRetry(() => db.from("strength_templates").select("id, name")),
    withJwtRetry(() => db.from("plan_sessions").select("id, date, phase, type, prescription, revision")),
    withJwtRetry(() => db.from("strength_logs").select("plan_session_id").not("plan_session_id", "is", null)),
  ]);
  if (tErr) throw new Error(`Load templates failed: ${tErr.message}`);
  if (sErr) throw new Error(`Load plan failed: ${sErr.message}`);
  if (lErr) throw new Error(`Load sessions failed: ${lErr.message}`);

  const idByName = new Map((templates ?? []).map((t) => [exerciseKey(t.name), t.id as string]));
  const templateIdOf = (name: string) => {
    const id = idByName.get(exerciseKey(name));
    if (!id) throw new Error(`No template called ${name}.`);
    return id;
  };

  // Each week's phase is the phase of its runs.
  const phaseByWeek = new Map<string, string>();
  for (const row of sessions ?? []) {
    if (isStrengthType(row.type)) continue;
    const week = mondayOf(row.date);
    if (!phaseByWeek.has(week)) phaseByWeek.set(week, row.phase);
  }

  const logged = new Set((logs ?? []).map((l) => l.plan_session_id as string));
  const seeded = (sessions ?? [])
    .filter((r) => isStrengthType(r.type) && (r.prescription as Record<string, unknown> | null)?.seed === SEED_MARKER)
    .map((r) => ({
      id: r.id as string,
      date: r.date as string,
      templateId: String((r.prescription as Record<string, unknown>).templateId ?? ""),
      revision: (r.revision as number) ?? 1,
      hasLog: logged.has(r.id as string),
    }));

  const desired = planStrengthSchedule({ today, raceDate: RACE_DATE, phaseForWeek: (week) => phaseByWeek.get(week) ?? null });
  const diff = diffSchedule(desired, seeded, templateIdOf, today);

  if (diff.deleteIds.length > 0) {
    const { error } = await withJwtRetry(() => db.from("plan_sessions").delete().in("id", diff.deleteIds));
    if (error) throw new Error(`Remove old strength sessions failed: ${error.message}`);
  }
  if (diff.insert.length > 0) {
    const { error } = await withJwtRetry(() => db.from("plan_sessions").insert(
      diff.insert.map((d) => ({
        date: d.date,
        phase: d.phase,
        type: d.type,
        prescription: { templateId: templateIdOf(d.templateName), templateName: d.templateName, seed: SEED_MARKER },
        cap: {},
        status: "planned",
        revision: 1,
      })),
    ));
    if (error) throw new Error(`Schedule strength sessions failed: ${error.message}`);
  }

  console.log(`Scheduled ${diff.insert.length} strength session(s), removed ${diff.deleteIds.length}, through ${desired[desired.length - 1]?.date ?? "n/a"}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
