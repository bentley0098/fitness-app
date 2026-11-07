// How the plan page groups and colours a planned session. Runs sort before
// strength work within a day. The run kinds follow the Barcelona plan's effort
// guide (recovery, aerobic, tempo, threshold, MP, long, benchmark); the older
// generic types (easy_run, quality_run) keep their own colours so sessions not
// yet retyped still read correctly.

export type SessionKind =
  | "easy"
  | "recovery"
  | "aerobic"
  | "tempo"
  | "threshold"
  | "mp"
  | "long"
  | "benchmark"
  | "workout"
  | "gym"
  | "physio";

export function sessionKind(type: string | null | undefined): SessionKind {
  switch (type) {
    case "strength_gym":
      return "gym";
    case "strength_physio":
      return "physio";
    case "recovery_run":
      return "recovery";
    case "aerobic_run":
      return "aerobic";
    case "tempo_run":
      return "tempo";
    case "threshold_run":
      return "threshold";
    case "mp_run":
      return "mp";
    case "long_run":
    case "marathon":
      return "long";
    case "benchmark_run":
      return "benchmark";
    case "quality_run":
    case "interval_run":
    case "intervals":
    case "workout_run":
      return "workout";
    default:
      return "easy";
  }
}

export const KIND_BAR: Record<SessionKind, string> = {
  easy: "bg-kind-easy",
  recovery: "bg-kind-recovery",
  aerobic: "bg-kind-aerobic",
  tempo: "bg-kind-tempo",
  threshold: "bg-kind-threshold",
  mp: "bg-kind-mp",
  long: "bg-kind-long",
  benchmark: "bg-kind-benchmark",
  workout: "bg-kind-workout",
  gym: "bg-kind-gym",
  physio: "bg-kind-physio",
};

/** Outline version of the bar colour, for a session still ahead. */
export const KIND_BORDER: Record<SessionKind, string> = {
  easy: "border-kind-easy",
  recovery: "border-kind-recovery",
  aerobic: "border-kind-aerobic",
  tempo: "border-kind-tempo",
  threshold: "border-kind-threshold",
  mp: "border-kind-mp",
  long: "border-kind-long",
  benchmark: "border-kind-benchmark",
  workout: "border-kind-workout",
  gym: "border-kind-gym",
  physio: "border-kind-physio",
};

const isStrength = (type: string | null) => sessionKind(type) === "gym" || sessionKind(type) === "physio";

/** Stable sort: runs first, strength after, otherwise original order. */
export function runsFirst<T extends { type: string | null }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => Number(isStrength(a.type)) - Number(isStrength(b.type)));
}
