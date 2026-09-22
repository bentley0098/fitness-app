// The Barcelona Marathon plan, as dated plan_sessions rows.
//
// Source of truth: the revised plan table (21 Sept 2026 revision, written
// after weeks 1-2 were completed). 27 weeks, Mon 7 Sept 2026 -> race day
// Sun 14 Mar 2027. Sub-3:30 goal at 4:58/km.
//
// Weekly pattern from week 7:
//   Mon  easy run + gym    (strides from wk 12, first quality run from wk 16)
//   Tue  swim              (not a run, no row)
//   Wed  easy run          (lengthens from wk 14)
//   Thu  full rest         (most fatigued day)
//   Fri  easy run + gym
//   Sat  long run          (marathon-pace segments from wk 18)
//   Sun  rest until wk 11, then a short easy run
//
// Rest days get NO row — absence of a row is meaningful, and the UI renders it
// as an explicit rest day.
//
// Run with: npm run plan:import              (writes to Supabase)
//           npm run plan:import -- --sql     (prints SQL instead, for the
//                                             Supabase SQL editor)
import { db } from "../server/utils/db";

type WalkRun = { kind: "walk_run"; durationMin: number; ratio: string; onDate?: string };
type Continuous = { kind: "continuous"; durationMin: number; approxKm: number };
type Distance = { kind: "distance"; km: number; note?: string; onDate?: string };
type Session = WalkRun | Continuous | Distance;

type Phase = "ramp" | "base" | "cutback" | "build" | "peak" | "taper" | "race";
type DayKey = "mon" | "wed" | "fri" | "sat" | "sun";

interface Week {
  week: number;
  phase: Phase;
  mon?: Session;
  wed?: Session;
  fri?: Session;
  sat?: Session;
  sun?: Session;
  /** Weekly total in km from the plan table, asserted against the sessions below. */
  totalKm?: number;
}

const PLAN_START_MONDAY = "2026-09-07";
const RACE_DATE = "2027-03-14";

const km = (n: number, note?: string): Distance => ({ kind: "distance", km: n, ...(note ? { note } : {}) });

const weeks: Week[] = [
  // Weeks 1-2 are complete. The plan table records which days they were
  // actually run on (Thu/Sat, then Thu/Sun) rather than the nominal Mon/Sat
  // slots, so the sessions are dated to match the real activities — otherwise
  // they'd read as missed with unplanned runs beside them.
  {
    week: 1,
    phase: "ramp",
    mon: { kind: "walk_run", durationMin: 10, ratio: "2:2", onDate: "2026-09-10" },
    sat: { kind: "walk_run", durationMin: 12, ratio: "2:2", onDate: "2026-09-12" },
  },
  {
    week: 2,
    phase: "ramp",
    mon: { kind: "walk_run", durationMin: 12, ratio: "2:2", onDate: "2026-09-17" },
    sat: { kind: "walk_run", durationMin: 15, ratio: "3:2", onDate: "2026-09-20" },
  },
  // Continuous running starts week 3, still two days.
  {
    week: 3,
    phase: "ramp",
    mon: { kind: "continuous", durationMin: 15, approxKm: 2.5 },
    sat: { kind: "continuous", durationMin: 18, approxKm: 3 },
  },
  // Km targets and a 3rd day start week 4; 4th day week 6.
  { week: 4, phase: "base", mon: km(3), wed: km(2.5), sat: km(4), totalKm: 9.5 },
  { week: 5, phase: "base", mon: km(4), wed: km(3), sat: km(5), totalKm: 12 },
  { week: 6, phase: "base", mon: km(4), wed: km(3), fri: km(3), sat: km(6), totalKm: 16 },
  { week: 7, phase: "base", mon: km(5), wed: km(4), fri: km(4), sat: km(7), totalKm: 20 },
  { week: 8, phase: "base", mon: km(5), wed: km(5), fri: km(4), sat: km(9), totalKm: 23 },
  { week: 9, phase: "base", mon: km(5), wed: km(5), fri: km(5), sat: km(11), totalKm: 26 },
  { week: 10, phase: "cutback", mon: km(4), wed: km(4), fri: km(4), sat: km(9), totalKm: 21 },
  // 5th run day (short easy Sunday) starts week 11.
  { week: 11, phase: "base", mon: km(5), wed: km(4), fri: km(4), sat: km(13), sun: km(3), totalKm: 29 },
  { week: 12, phase: "base", mon: km(5, "strides"), wed: km(5), fri: km(4), sat: km(15), sun: km(3), totalKm: 32 },
  { week: 13, phase: "cutback", mon: km(4, "strides"), wed: km(4), fri: km(3), sat: km(12), sun: km(3), totalKm: 26 },
  // Wednesday run starts lengthening from week 14.
  { week: 14, phase: "build", mon: km(5, "strides"), wed: km(6), fri: km(4), sat: km(17), sun: km(3), totalKm: 35 },
  { week: 15, phase: "build", mon: km(5, "strides"), wed: km(7), fri: km(4), sat: km(19), sun: km(3), totalKm: 38 },
  // First quality run week 16 (physio OK).
  { week: 16, phase: "build", mon: km(5, "first quality session"), wed: km(8), fri: km(5), sat: km(21), sun: km(3), totalKm: 42 },
  { week: 17, phase: "cutback", mon: km(5), wed: km(6), fri: km(5), sat: km(15), sun: km(3), totalKm: 34 },
  // Marathon-pace segments in the long run from week 18.
  { week: 18, phase: "build", mon: km(6), wed: km(9), fri: km(5), sat: km(23, "MP segments"), sun: km(3), totalKm: 46 },
  { week: 19, phase: "build", mon: km(6), wed: km(10), fri: km(5), sat: km(25, "MP segments"), sun: km(4), totalKm: 50 },
  { week: 20, phase: "build", mon: km(7), wed: km(11), fri: km(5), sat: km(27, "MP segments"), sun: km(4), totalKm: 54 },
  { week: 21, phase: "cutback", mon: km(6), wed: km(9), fri: km(4), sat: km(20, "MP segments"), sun: km(4), totalKm: 43 },
  { week: 22, phase: "peak", mon: km(7), wed: km(12), fri: km(5), sat: km(30, "MP segments"), sun: km(4), totalKm: 58 },
  { week: 23, phase: "peak", mon: km(7), wed: km(13), fri: km(6), sat: km(32, "MP segments"), sun: km(4), totalKm: 62 },
  // Last long run, three weeks out. First week to trim if a gate fails.
  { week: 24, phase: "peak", mon: km(8), wed: km(14), fri: km(6), sat: km(34, "last long run"), sun: km(4), totalKm: 66 },
  { week: 25, phase: "taper", mon: km(8), wed: km(10), fri: km(6), sat: km(20, "8km at MP"), sun: km(4), totalKm: 48 },
  { week: 26, phase: "taper", mon: km(7), wed: km(8, "3x2km at MP"), fri: km(5), sat: km(13), sun: km(3), totalKm: 36 },
  // Race week: Sat rests the legs, Sunday is the race (added separately).
  { week: 27, phase: "race", mon: km(6), wed: km(6, "3x1km at MP + strides"), fri: km(4, "shakeout"), totalKm: 16 },
];

const DAY_OFFSETS: Record<DayKey, number> = { mon: 0, wed: 2, fri: 4, sat: 5, sun: 6 };

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayForWeek(week: number): string {
  return addDays(PLAN_START_MONDAY, (week - 1) * 7);
}

function typeFor(day: DayKey, week: number, session: Session): string {
  // Weeks 1-3 are run-walk then continuous — no easy/long distinction yet.
  if (week <= 3) return "walk_run_or_continuous";

  // A long run with marathon-pace segments is still a long run.
  if (day === "sat") return "long_run";
  if (day === "sun") return "easy_run";

  // Anything the plan annotates with marathon-pace work is a quality session,
  // wherever it falls — that's the week 26 and race-week Wednesdays.
  const note = session.kind === "distance" ? (session.note ?? "") : "";
  if (/\bMP\b/.test(note)) return "quality_run";

  // Monday is the quality slot once quality work starts (week 16) — but the
  // taper and race-week Mondays are plain distances in the plan, with the
  // sharpening moved to Wednesday, so they stay easy.
  if (day === "mon") return week >= 16 && week <= 24 ? "quality_run" : "easy_run";

  return "easy_run"; // wed, fri
}

function prescriptionFor(session: Session): Record<string, unknown> {
  if (session.kind === "walk_run") return { durationMin: session.durationMin, ratio: session.ratio };
  if (session.kind === "continuous") return { durationMin: session.durationMin, approxKm: session.approxKm };
  return session.note ? { distanceKm: session.km, note: session.note } : { distanceKm: session.km };
}

interface Row {
  date: string;
  phase: string;
  type: string;
  prescription: Record<string, unknown>;
}

export function buildRows(): Row[] {
  const rows: Row[] = [];

  for (const w of weeks) {
    const monday = mondayForWeek(w.week);

    for (const day of ["mon", "wed", "fri", "sat", "sun"] as DayKey[]) {
      const session = w[day];
      if (!session) continue; // rest day — no row
      const onDate = "onDate" in session ? session.onDate : undefined;
      rows.push({
        date: onDate ?? addDays(monday, DAY_OFFSETS[day]),
        phase: w.phase,
        type: typeFor(day, w.week, session),
        prescription: prescriptionFor(session),
      });
    }
  }

  // Race day — its own row, not folded into week 27's Sunday slot.
  rows.push({
    date: RACE_DATE,
    phase: "race",
    type: "marathon",
    prescription: { distanceKm: 42.2, goal: "sub-3:30", pace: "4:58/km" },
  });

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Guards against transcription drift between the plan table and this file.
 * Every week total in the plan is re-derived from the sessions here and
 * compared; a mismatch fails the import rather than silently writing a plan
 * that doesn't match the one being followed.
 */
export function verify(): string[] {
  const problems: string[] = [];

  for (const w of weeks) {
    if (w.totalKm == null) continue;
    const sum = (["mon", "wed", "fri", "sat", "sun"] as DayKey[])
      .map((d) => w[d])
      .filter((s): s is Distance => !!s && s.kind === "distance")
      .reduce((acc, s) => acc + s.km, 0);
    if (Math.abs(sum - w.totalKm) > 0.001) {
      problems.push(`week ${w.week}: sessions total ${sum}km, plan says ${w.totalKm}km`);
    }
  }

  // Every nominal week start must be a Monday, and race day a Sunday.
  for (const w of weeks) {
    const monday = mondayForWeek(w.week);
    if (new Date(`${monday}T00:00:00Z`).getUTCDay() !== 1) {
      problems.push(`week ${w.week}: ${monday} is not a Monday`);
    }
  }
  if (new Date(`${RACE_DATE}T00:00:00Z`).getUTCDay() !== 0) problems.push(`race day ${RACE_DATE} is not a Sunday`);
  if (weeks.length !== 27) problems.push(`expected 27 weeks, got ${weeks.length}`);
  if (mondayForWeek(27) !== "2027-03-08") problems.push(`week 27 starts ${mondayForWeek(27)}, expected 2027-03-08`);

  return problems;
}

function toSql(rows: Row[]): string {
  const values = rows
    .map(
      (r) =>
        `  ('${r.date}', '${r.phase}', '${r.type}', '${JSON.stringify(r.prescription)}'::jsonb, '{}'::jsonb, 'planned', 1)`,
    )
    .join(",\n");

  return [
    "BEGIN;",
    "",
    "-- Replaces the plan wholesale. plan_revisions rows cascade with their",
    "-- session; run history lives in `activities` and is not touched.",
    "DELETE FROM plan_sessions;",
    "",
    "INSERT INTO plan_sessions (date, phase, type, prescription, cap, status, revision) VALUES",
    `${values};`,
    "",
    "COMMIT;",
  ].join("\n");
}

async function main() {
  const problems = verify();
  if (problems.length) {
    console.error("Plan verification failed:");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }

  const rows = buildRows();

  if (process.argv.includes("--sql")) {
    console.log(toSql(rows));
    return;
  }

  const { error: cleanupError } = await db.from("plan_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (cleanupError) throw new Error(`Cleanup failed: ${cleanupError.message}`);

  const { error } = await db.from("plan_sessions").insert(
    rows.map((r) => ({
      date: r.date,
      phase: r.phase,
      type: r.type,
      prescription: r.prescription,
      cap: {},
      status: "planned",
      revision: 1,
    })),
  );
  if (error) throw new Error(`Insert failed: ${error.message}`);

  console.log(`Imported ${rows.length} sessions, ${rows[0]!.date} -> ${rows[rows.length - 1]!.date}.`);
}

// Only run when invoked directly, so the test suite can import buildRows/verify.
if (process.argv[1]?.includes("import-barcelona-plan")) main();
