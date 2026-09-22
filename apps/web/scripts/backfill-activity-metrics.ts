// Backfills vo2_max / training_load / aerobic_te / anaerobic_te onto
// activities ingested before those columns existed.
//
// Costs zero Garmin API calls: syncGarmin.ts has always stored the full
// activity detail in raw_payload, and these values were in there the whole
// time — there was just no column to put them in. The extraction is the same
// function the live sync uses, so a backfilled row is identical to a freshly
// synced one.
//
// Garmin only computes VO2 max for qualifying outdoor runs with heart rate, so
// a low hit count is a fact about the data, not a failure. The counts printed
// at the end are the check.
//
// Run with: npm run activities:backfill
import { extractActivityMetrics, hasAnyMetric } from "../server/utils/garminActivityMetrics";
import { db } from "../server/utils/db";

async function main() {
  const { data: rows, error } = await db
    .from("activities")
    .select("id, date, external_id, raw_payload")
    .is("vo2_max", null)
    .order("date", { ascending: true });

  if (error) throw new Error(`Load failed: ${error.message}`);
  if (!rows?.length) {
    console.log("Nothing to backfill — no activities with a null vo2_max.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];
  const withVo2: string[] = [];

  for (const row of rows) {
    const metrics = extractActivityMetrics(row.raw_payload);

    if (!hasAnyMetric(metrics)) {
      skipped++;
      continue;
    }

    // update(), never upsert(): Supabase upsert is an insert-on-conflict, so a
    // partial object would fail external_id/date NOT NULL rather than patching
    // the existing row.
    const { error: updateError } = await db.from("activities").update(metrics).eq("id", row.id);

    if (updateError) {
      errors.push(`${row.external_id}: ${updateError.message}`);
      continue;
    }

    updated++;
    if (metrics.vo2_max != null) withVo2.push(`${row.date} → ${metrics.vo2_max}`);
  }

  console.log(`scanned ${rows.length}, updated ${updated}, skipped ${skipped} (no metrics in payload)`);
  if (withVo2.length) {
    console.log(`\nvo2_max found on ${withVo2.length}:`);
    for (const line of withVo2) console.log(`  ${line}`);
  } else {
    console.log("\nNo vo2_max in any stored payload. Garmin only computes it for");
    console.log("qualifying outdoor runs with HR — the VO2 tile will show '—' until");
    console.log("one of those syncs.");
  }
  if (errors.length) {
    console.log(`\n${errors.length} update(s) failed:`);
    for (const e of errors) console.log(`  ${e}`);
  }
}

main();
