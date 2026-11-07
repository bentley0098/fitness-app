// A few seconds of memory in front of the whole-table reads.
//
// Opening Home fires /api/plan-sessions three times (this week plus its two
// neighbours) and /api/dashboard once. Each one re-read every activity and
// plan row from Supabase, so one screen cost four copies of the same queries.
// Sharing the in-flight promise collapses those to one; the short TTL makes
// tab-hopping free too.
//
// Per-instance and best effort, like the sync cooldown. Writes call bustMemo()
// (see server/middleware/bust-memo.ts) so a change is never hidden behind it.
const TTL_MS = 15_000;

interface Entry {
  at: number;
  value: Promise<unknown>;
}

const entries = new Map<string, Entry>();
let generation = 0;

export function memoAsync<T>(key: string, load: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;

  const startedIn = generation;
  const value = load().catch((err) => {
    // Never keep a failure around.
    if (entries.get(key)?.value === value) entries.delete(key);
    throw err;
  });
  entries.set(key, { at: Date.now(), value });
  // A write that landed while this was loading makes the result suspect.
  void value.then(() => {
    if (generation !== startedIn && entries.get(key)?.value === value) entries.delete(key);
  }, () => {});
  return value;
}

export function bustMemo(): void {
  generation++;
  entries.clear();
}
