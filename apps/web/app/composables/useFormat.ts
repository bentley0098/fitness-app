// Display formatting. Kept in one place so `(x / 1000).toFixed(1)` doesn't
// get re-derived in a dozen templates with slightly different rounding.

const DASH = "—";

export function formatDistance(metres: number | null | undefined, digits = 1): string {
  if (metres == null || !Number.isFinite(metres)) return DASH;
  return (metres / 1000).toFixed(digits);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Sleep and other multi-hour spans read as "7h 30m". formatDuration's
 * stopwatch form (7:30:00) is right for a run and wrong for a night's sleep.
 */
export function formatHoursMinutes(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Seconds per km → `5:24`. Returns the dash for a pace that isn't meaningful. */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return DASH;
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function paceFrom(distanceM: number | null | undefined, movingTimeS: number | null | undefined): number | null {
  if (!distanceM || !movingTimeS || distanceM <= 0 || movingTimeS <= 0) return null;
  return movingTimeS / (distanceM / 1000);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return value.toFixed(digits);
}

// ISO dates are parsed as UTC midnight deliberately — every date in this app
// is a plain calendar date, and letting the runtime apply a local offset to a
// bare "YYYY-MM-DD" shifts it a day in negative-offset zones.
function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function weekdayShort(iso: string): string {
  return parseIso(iso).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

export function dayOfMonth(iso: string): number {
  return parseIso(iso).getUTCDate();
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  return parseIso(iso).toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}

export function formatMonthLabel(iso: string): string {
  return parseIso(iso).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "Easy run" from "easy_run"; falls back to the raw key it doesn't know. */
export function humanizeType(type: string | null | undefined): string {
  if (!type) return DASH;
  const known: Record<string, string> = {
    easy_run: "Easy run",
    moderate_run: "Moderate run",
    quality_run: "Quality run",
    long_run: "Long run",
    walk_run_or_continuous: "Walk/run",
    marathon: "Marathon",
    "weekly-target": "Weekly target",
  };
  if (known[type]) return known[type]!;
  return type.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function humanizePhase(phase: string | null | undefined): string {
  if (!phase) return DASH;
  return phase.replace(/^\w/, (c) => c.toUpperCase());
}

export { DASH };
