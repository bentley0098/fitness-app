// Shared coercion helpers for Garmin payloads.
//
// Garmin's wellness and activity endpoints use negative sentinels (-1, -2) for
// "no data" rather than null, so a naive `?? null` happily stores -1 as a real
// reading. This rule was previously encoded twice (syncHealthMetrics.ts's
// avgValidValues/minMaxValues); it now applies in three files, so it lives
// here.
//
// Many of the fields these are applied to are absent from the SDK's strict Zod
// types and arrive only via `.passthrough()`, so the inputs are genuinely
// `unknown` — that's deliberate, not laziness.

/** A finite, non-negative number, or null. */
export function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** A finite number of any sign, or null. Elevation and TE deltas can be negative. */
export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Garmin returns sleep boundaries as epoch milliseconds already shifted to the
 * device's local time. Rendered as a tz-naive "YYYY-MM-DDTHH:MM:SS" string so
 * Postgres stores the wall-clock the watch recorded rather than re-applying an
 * offset to it.
 */
export function localTimestamp(epochMs: unknown): string | null {
  if (typeof epochMs !== "number" || !Number.isFinite(epochMs) || epochMs <= 0) return null;
  return new Date(epochMs).toISOString().slice(0, 19);
}
