// Tolerates a database whose schema lags the deployed code.
//
// Replacing select("*") with explicit column lists made every read depend on
// migration 0006 having been applied. Deploying before running the migration
// therefore 500'd every screen — including Plan and Activity, which don't use
// any of the new columns. A missing optional metric should be a blank tile,
// not an outage.
//
// Strategy: ask for the full column list; if PostgREST rejects it because a
// column doesn't exist, retry once with the pre-0006 set. No cached flag —
// a sticky "degraded" bit would keep the app degraded after the migration
// finally ran, until someone redeployed. The extra round trip only happens
// while the schema is actually behind.

/** PostgREST's undefined_column. Also matched on message, since the code isn't always populated. */
export function isMissingColumnError(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return /column .* does not exist/i.test(error.message ?? "");
}

let warned = false;
function warnOnce(table: string) {
  if (warned) return;
  warned = true;
  console.warn(
    `[schema] ${table}: columns from migration 0006 are missing — serving without them. ` +
      `Apply server/database/migrations/0006_nice_captain_cross.sql to restore sleep and VO2 max.`,
  );
}

interface Result<T> {
  data: T[] | null;
  error: { code?: string | null; message?: string | null } | null;
}

/**
 * `run` is called with a column list and must return the built query. It is
 * invoked a second time with `base` if the first attempt hits a missing column.
 */
export async function selectTolerant<T>(
  table: string,
  full: string,
  base: string,
  run: (columns: string) => PromiseLike<Result<T>>,
): Promise<Result<T>> {
  const first = await run(full);
  if (!isMissingColumnError(first.error)) return first;

  warnOnce(table);
  return run(base);
}

/**
 * Same idea for writes. If the row carries columns the database doesn't have
 * yet, retry without them rather than losing the whole write — otherwise the
 * nightly sync stops ingesting activities and health metrics entirely just
 * because it can't also store sleep.
 */
export async function writeTolerant<E extends { code?: string | null; message?: string | null } | null>(
  table: string,
  row: Record<string, unknown>,
  optionalKeys: readonly string[],
  run: (row: Record<string, unknown>) => PromiseLike<{ error: E }>,
): Promise<{ error: E; degraded: boolean }> {
  const first = await run(row);
  if (!isMissingColumnError(first.error)) return { error: first.error, degraded: false };

  warnOnce(table);
  const reduced = Object.fromEntries(Object.entries(row).filter(([k]) => !optionalKeys.includes(k)));
  const second = await run(reduced);
  return { error: second.error, degraded: true };
}

export const ACTIVITY_OPTIONAL_KEYS = ["vo2_max", "training_load", "aerobic_te", "anaerobic_te"] as const;

export const SLEEP_OPTIONAL_KEYS = [
  "sleep_time_s",
  "deep_sleep_s",
  "light_sleep_s",
  "rem_sleep_s",
  "awake_sleep_s",
  "sleep_score",
  "sleep_start_local",
  "sleep_end_local",
] as const;
