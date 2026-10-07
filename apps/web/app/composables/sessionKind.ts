// How the plan page groups and colours a planned session. Runs sort before
// strength work within a day; `workout` types (intervals, tempo, …) have no
// designed sessions yet but already map to orange.

export type SessionKind = "easy" | "gym" | "physio" | "long" | "workout";

export function sessionKind(type: string | null | undefined): SessionKind {
  switch (type) {
    case "strength_gym":
      return "gym";
    case "strength_physio":
      return "physio";
    case "long_run":
    case "marathon":
      return "long";
    case "quality_run":
    case "interval_run":
    case "intervals":
    case "workout_run":
    case "tempo_run":
      return "workout";
    default:
      return "easy";
  }
}

export const KIND_BAR: Record<SessionKind, string> = {
  easy: "bg-kind-easy",
  gym: "bg-kind-gym",
  physio: "bg-kind-physio",
  long: "bg-kind-long",
  workout: "bg-kind-workout",
};

const isStrength = (type: string | null) => sessionKind(type) === "gym" || sessionKind(type) === "physio";

/** Stable sort: runs first, strength after, otherwise original order. */
export function runsFirst<T extends { type: string | null }>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => Number(isStrength(a.type)) - Number(isStrength(b.type)));
}
