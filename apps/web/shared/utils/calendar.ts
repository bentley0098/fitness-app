// Calendar module: what Today is, and plain-date arithmetic.
//
// Every date in this app is a plain "YYYY-MM-DD" calendar date. Arithmetic
// parses at UTC midnight on purpose: letting the runtime apply a local offset
// to a bare date shifts it a day in negative-offset zones.
//
// Nothing here reads the runtime's clock or timezone. `today` takes the
// instant and the zone from its caller, so a test pins both.

/** Zone used wherever no device is involved: MCP tools and the Garmin sync. */
export const DEFAULT_ZONE = "Europe/Dublin";

const MS_PER_DAY = 86_400_000;

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function utcIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `zone` if it names a real IANA zone, otherwise DEFAULT_ZONE. */
export function resolveZone(zone: string | null | undefined): string {
  if (!zone) return DEFAULT_ZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return zone;
  } catch {
    return DEFAULT_ZONE;
  }
}

/** The calendar date of the instant `now` as seen in `zone`. */
export function today(now: Date, zone: string | null | undefined = DEFAULT_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveZone(zone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDaysIso(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return utcIso(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso).getTime() - toUtc(fromIso).getTime()) / MS_PER_DAY);
}

/** 0 = Monday .. 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const day = toUtc(iso).getUTCDay(); // 0 = Sunday
  return day === 0 ? 6 : day - 1;
}

/** The ISO Monday on or before `iso`. */
export function mondayOf(iso: string): string {
  return addDaysIso(iso, -weekdayIndex(iso));
}

/** The seven ISO dates of the week containing `iso`, Monday first. */
export function weekDates(iso: string): string[] {
  const start = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
}
