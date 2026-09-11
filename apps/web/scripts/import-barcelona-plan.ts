// One-time import of the 27-week Barcelona Marathon plan
// (~/Downloads/barcelona-marathon-plan.html) into plan_sessions. This is the
// baseline schedule, not an engine adaptation — inserted directly as
// status: "planned", no plan_revisions audit row (that's for tracking
// engine-driven changes to this baseline later, not the baseline itself).
//
// Run with: npm run plan:import
import { db } from "../server/utils/db";

type DistanceKm = { kind: "distance"; km: number };
type WalkRun = { kind: "walk_run"; durationMin: number; ratio: string };
type Continuous = { kind: "continuous"; durationMin: number; approxKm?: number };
type Shakeout = { kind: "distance"; km: number; note: "shakeout" };
type Session = DistanceKm | WalkRun | Continuous | Shakeout;

interface Week {
  week: number;
  phase: "ramp" | "base" | "cutback" | "build" | "peak" | "taper" | "race";
  monday: string; // ISO date of that week's Monday
  mon?: Session;
  wed?: Session;
  fri?: Session;
  sat?: Session;
}

const weeks: Week[] = [
  // Week 1 is irregular — starts Thursday, not Monday. Handled separately below.
  { week: 2, phase: "ramp", monday: "2026-09-15", mon: { kind: "walk_run", durationMin: 12, ratio: "2:2" }, sat: { kind: "walk_run", durationMin: 15, ratio: "3:2" } },
  { week: 3, phase: "ramp", monday: "2026-09-22", mon: { kind: "continuous", durationMin: 15, approxKm: 2.5 }, sat: { kind: "continuous", durationMin: 18, approxKm: 3 } },
  { week: 4, phase: "base", monday: "2026-09-29", mon: { kind: "distance", km: 3 }, wed: { kind: "distance", km: 2.5 }, sat: { kind: "distance", km: 4 } },
  { week: 5, phase: "base", monday: "2026-10-06", mon: { kind: "distance", km: 4 }, wed: { kind: "distance", km: 3 }, sat: { kind: "distance", km: 5 } },
  { week: 6, phase: "base", monday: "2026-10-13", mon: { kind: "distance", km: 4 }, wed: { kind: "distance", km: 3 }, fri: { kind: "distance", km: 3 }, sat: { kind: "distance", km: 6 } },
  { week: 7, phase: "base", monday: "2026-10-20", mon: { kind: "distance", km: 5 }, wed: { kind: "distance", km: 4 }, fri: { kind: "distance", km: 4 }, sat: { kind: "distance", km: 7 } },
  { week: 8, phase: "base", monday: "2026-10-27", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 5 }, fri: { kind: "distance", km: 6 }, sat: { kind: "distance", km: 9 } },
  { week: 9, phase: "base", monday: "2026-11-03", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 5 }, fri: { kind: "distance", km: 6 }, sat: { kind: "distance", km: 10 } },
  { week: 10, phase: "cutback", monday: "2026-11-10", mon: { kind: "distance", km: 5 }, wed: { kind: "distance", km: 5 }, fri: { kind: "distance", km: 5 }, sat: { kind: "distance", km: 8 } },
  { week: 11, phase: "base", monday: "2026-11-17", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 6 }, fri: { kind: "distance", km: 6 }, sat: { kind: "distance", km: 11 } },
  { week: 12, phase: "base", monday: "2026-11-24", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 6 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 13 } },
  { week: 13, phase: "cutback", monday: "2026-12-01", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 5 }, fri: { kind: "distance", km: 6 }, sat: { kind: "distance", km: 11 } },
  { week: 14, phase: "build", monday: "2026-12-08", mon: { kind: "distance", km: 7 }, wed: { kind: "distance", km: 6 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 15 } },
  { week: 15, phase: "build", monday: "2026-12-15", mon: { kind: "distance", km: 7 }, wed: { kind: "distance", km: 7 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 17 } },
  { week: 16, phase: "build", monday: "2026-12-22", mon: { kind: "distance", km: 7 }, wed: { kind: "distance", km: 7 }, fri: { kind: "distance", km: 8 }, sat: { kind: "distance", km: 19 } },
  { week: 17, phase: "cutback", monday: "2026-12-29", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 6 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 15 } },
  { week: 18, phase: "build", monday: "2027-01-05", mon: { kind: "distance", km: 8 }, wed: { kind: "distance", km: 7 }, fri: { kind: "distance", km: 8 }, sat: { kind: "distance", km: 21 } },
  { week: 19, phase: "build", monday: "2027-01-12", mon: { kind: "distance", km: 8 }, wed: { kind: "distance", km: 7 }, fri: { kind: "distance", km: 8 }, sat: { kind: "distance", km: 23 } },
  { week: 20, phase: "cutback", monday: "2027-01-19", mon: { kind: "distance", km: 7 }, wed: { kind: "distance", km: 6 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 18 } },
  { week: 21, phase: "peak", monday: "2027-01-26", mon: { kind: "distance", km: 9 }, wed: { kind: "distance", km: 7 }, fri: { kind: "distance", km: 8 }, sat: { kind: "distance", km: 25 } },
  { week: 22, phase: "peak", monday: "2027-02-02", mon: { kind: "distance", km: 9 }, wed: { kind: "distance", km: 8 }, fri: { kind: "distance", km: 9 }, sat: { kind: "distance", km: 28 } },
  { week: 23, phase: "peak", monday: "2027-02-09", mon: { kind: "distance", km: 9 }, wed: { kind: "distance", km: 8 }, fri: { kind: "distance", km: 9 }, sat: { kind: "distance", km: 32 } },
  { week: 24, phase: "cutback", monday: "2027-02-16", mon: { kind: "distance", km: 7 }, wed: { kind: "distance", km: 6 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 20 } },
  { week: 25, phase: "taper", monday: "2027-02-23", mon: { kind: "distance", km: 8 }, wed: { kind: "distance", km: 7 }, fri: { kind: "distance", km: 7 }, sat: { kind: "distance", km: 18 } },
  { week: 26, phase: "taper", monday: "2027-03-02", mon: { kind: "distance", km: 6 }, wed: { kind: "distance", km: 5 }, fri: { kind: "distance", km: 5 }, sat: { kind: "distance", km: 12 } },
  // Week 27: corrected anchor. The source file's own headline stat ("Sun Mar
  // 14" race day) is the one fact confirmed against the real calendar — Mar
  // 14, 2027 genuinely is a Sunday. Its "Mar 9–15" week label doesn't match
  // that (would make Sat the 14th, not Sun); using Mon Mar 8 instead, which
  // does. Sat (Mar 13) gets no session — legs rest the day before the race,
  // matching what the source file's Sat-column note ("Race Sun Mar 14") was
  // actually gesturing at, not a literal Saturday session.
  { week: 27, phase: "race", monday: "2027-03-08", mon: { kind: "distance", km: 4, note: "shakeout" } as Shakeout, fri: { kind: "distance", km: 3, note: "shakeout" } as Shakeout },
];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function typeFor(day: "mon" | "wed" | "fri" | "sat", week: number, phase: Week["phase"]): string {
  if (phase === "ramp") return "walk_run_or_continuous";
  if (day === "sat") return "long_run";
  if (day === "mon") return week >= 7 ? "quality_run" : "easy_run";
  if (day === "fri") return week >= 7 ? "moderate_run" : "easy_run";
  return "easy_run"; // wed
}

function prescriptionFor(session: Session): Record<string, unknown> {
  if (session.kind === "walk_run") return { durationMin: session.durationMin, ratio: session.ratio };
  if (session.kind === "continuous") return { durationMin: session.durationMin, approxKm: session.approxKm };
  return "note" in session ? { distanceKm: session.km, note: session.note } : { distanceKm: session.km };
}

interface Row {
  date: string;
  phase: string;
  type: string;
  prescription: Record<string, unknown>;
}

function buildRows(): Row[] {
  const rows: Row[] = [];

  // Week 1 — irregular, starts Thursday (today, per the source file).
  rows.push({ date: "2026-09-10", phase: "ramp", type: "walk_run_or_continuous", prescription: { durationMin: 10, ratio: "2:2" } });
  rows.push({ date: "2026-09-12", phase: "ramp", type: "walk_run_or_continuous", prescription: { durationMin: 12, ratio: "2:2" } });

  for (const w of weeks) {
    const dayOffsets: Array<["mon" | "wed" | "fri" | "sat", number]> = [
      ["mon", 0],
      ["wed", 2],
      ["fri", 4],
      ["sat", 5],
    ];
    for (const [day, offset] of dayOffsets) {
      const session = w[day];
      if (!session) continue; // rest day — no row
      rows.push({
        date: addDays(w.monday, offset),
        phase: w.phase,
        type: typeFor(day, w.week, w.phase),
        prescription: prescriptionFor(session),
      });
    }
  }

  // Race day — its own entry, not folded into week 27's Saturday slot.
  rows.push({ date: "2027-03-14", phase: "race", type: "marathon", prescription: { goal: "sub-3:30", pace: "4:58/km" } });

  return rows;
}

async function main() {
  const rows = buildRows();

  // Remove the earlier test placeholder from Phase 5 development — a
  // "weekly-target" volume-only row, superseded by this real plan.
  const { error: cleanupError } = await db.from("plan_sessions").delete().eq("type", "weekly-target");
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

  console.log(`Imported ${rows.length} sessions, ${rows[0].date} → ${rows[rows.length - 1].date}.`);
}

main();
