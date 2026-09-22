// One-off correction: the imported Barcelona plan sits one day late.
//
// import-barcelona-plan.ts anchors weeks 2-26 on fields named `monday:` whose
// values are actually TUESDAYS (2026-09-15, 2026-09-22, 2026-12-08 … all fall
// on a Tuesday; the Monday of that first week was 2026-09-14). With the day
// offsets [mon 0, wed 2, fri 4, sat 5] that put every session one day later
// than intended, so the stored weekdays read Tue/Thu/Sat/Sun instead of
// Mon/Wed/Fri/Sat.
//
// Not affected, and deliberately untouched:
//   - Week 1 (2026-09-10, 2026-09-12) — an intentionally irregular week that
//     starts on a Thursday.
//   - Week 27 (anchored 2027-03-08, genuinely a Monday) and race day
//     (2027-03-14, genuinely a Sunday) — the import script already corrected
//     this stretch by hand.
//
// So the fix is exactly: shift every plan session between 2026-09-15 and
// 2027-03-07 back by one day.
//
// This rewrites real training data, so it is dry-run by default and prints
// every change. Pass --apply to actually write.
//
// Run with: npm run plan:fix-dates            (dry run)
//           npm run plan:fix-dates -- --apply (writes)
import { db } from "../server/utils/db";

const SHIFT_FROM = "2026-09-15"; // week 2, first session (a Tuesday)
const SHIFT_TO = "2027-03-07"; // week 26, last session (a Sunday)

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekday(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

async function main() {
  const apply = process.argv.includes("--apply");

  const { data: rows, error } = await db
    .from("plan_sessions")
    .select("id, date, phase, type")
    .gte("date", SHIFT_FROM)
    .lte("date", SHIFT_TO)
    // Engine-drafted volume rows aren't part of the imported plan and have no
    // weekday semantics to correct.
    .neq("type", "weekly-target")
    .order("date", { ascending: true });

  if (error) throw new Error(`Load failed: ${error.message}`);
  if (!rows?.length) {
    console.log(`No plan sessions between ${SHIFT_FROM} and ${SHIFT_TO}. Nothing to do.`);
    return;
  }

  console.log(`${apply ? "APPLYING" : "DRY RUN"} — shifting ${rows.length} sessions back one day\n`);
  console.log("  before            after");
  console.log("  ----------------  ----------------");
  for (const row of rows) {
    const next = addDays(row.date, -1);
    console.log(`  ${row.date} ${weekday(row.date).padEnd(3)}  →  ${next} ${weekday(next).padEnd(3)}  ${row.type}`);
  }

  if (!apply) {
    console.log(`\nDry run — nothing written. Re-run with --apply to commit these ${rows.length} changes.`);
    return;
  }

  let updated = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const { error: updateError } = await db
      .from("plan_sessions")
      .update({ date: addDays(row.date, -1), updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateError) {
      errors.push(`${row.date}: ${updateError.message}`);
      continue;
    }
    updated++;
  }

  console.log(`\nUpdated ${updated} of ${rows.length}.`);
  if (errors.length) {
    console.log(`${errors.length} failed:`);
    for (const e of errors) console.log(`  ${e}`);
  }
}

main();
