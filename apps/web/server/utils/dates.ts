// Pure ISO-date helpers. No imports, no side effects.
//
// These lived in trainingData.ts, which constructs the Supabase client at
// module load — so anything importing them for arithmetic alone (planMeta,
// and its tests) dragged in a live DB connection. trainingData re-exports
// them, so every existing caller is unaffected.
//
// Every date in this app is a plain calendar date. Parsing at UTC midnight is
// deliberate: letting the runtime apply a local offset to a bare "YYYY-MM-DD"
// shifts it a day in negative-offset zones.

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
