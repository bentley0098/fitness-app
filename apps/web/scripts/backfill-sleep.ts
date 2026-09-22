// Backfills historical sleep into daily_health_metrics.
//
// Unlike VO2 max, sleep genuinely cannot be recovered from stored data — rows
// written before this change have no `sleep` key in raw_payload, because the
// sync never called the endpoint. So this one does hit Garmin, via
// getSleepRange (one call for the whole window rather than one per day).
//
// Deliberately a script and not part of the cron route: 30-60 days of sleep is
// a slow call, and the cron runs as a Vercel function with a hard timeout.
//
// Run with: npm run health:backfill [-- --days=60]
import { extractSleep, hasAnySleep } from "../server/utils/garminSleep";
import { db } from "../server/utils/db";
import { garmin } from "../server/utils/garmin";

type Raw = Record<string, any>;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDays(): number {
  const arg = process.argv.find((a) => a.startsWith("--days="));
  const n = arg ? Number(arg.split("=")[1]) : 30;
  return Number.isFinite(n) && n > 0 && n <= 365 ? Math.floor(n) : 30;
}

async function main() {
  const days = parseDays();

  const restored = await garmin.restoreSession();
  if (!restored) {
    throw new Error("No stored Garmin session — run `npm run garmin:login` first.");
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));

  console.log(`Fetching sleep ${isoDate(start)} → ${isoDate(end)} (${days} days)…`);

  const range = (await garmin.sleep.getSleepRange(start, end)) as Raw;

  // getSleepRange's payload shape isn't in the SDK's strict types either;
  // accept the handful of container keys it's been seen to use rather than
  // assuming one.
  const entries: Raw[] = Array.isArray(range)
    ? range
    : (range?.dailySleepDTOList ?? range?.sleepList ?? range?.entries ?? []);

  if (!entries.length) {
    console.log("Garmin returned no sleep entries for that window.");
    return;
  }

  let updated = 0;
  let empty = 0;
  let missingDay = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const dto: Raw = entry?.dailySleepDTO ?? entry ?? {};
    const day: string | undefined = dto.calendarDate?.slice(0, 10);
    if (!day) {
      missingDay++;
      continue;
    }

    const sleep = extractSleep(entry, day);
    if (!hasAnySleep(sleep)) {
      empty++;
      continue;
    }

    // Partial update keyed on date, NOT an upsert — the row already holds HRV,
    // resting HR, body battery and stress for that day, and an upsert would
    // replace all of it with nulls.
    const { data: existing, error: lookupError } = await db
      .from("daily_health_metrics")
      .select("id")
      .eq("date", day)
      .maybeSingle();

    if (lookupError) {
      errors.push(`${day}: lookup — ${lookupError.message}`);
      continue;
    }

    const { error: writeError } = existing
      ? await db.from("daily_health_metrics").update(sleep).eq("date", day)
      : // No metrics row for that day at all (the health sync only covers the
        // last 7 days). Insert one carrying just the sleep columns; a later
        // sync upserts the rest on top.
        await db.from("daily_health_metrics").insert({ date: day, hrv_status: "unknown", ...sleep });

    if (writeError) {
      errors.push(`${day}: write — ${writeError.message}`);
      continue;
    }
    updated++;
  }

  console.log(`entries ${entries.length}, written ${updated}, no-data ${empty}, undated ${missingDay}`);
  if (errors.length) {
    console.log(`\n${errors.length} failed:`);
    for (const e of errors) console.log(`  ${e}`);
  }
}

main();
