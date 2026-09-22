// Turns a plan_sessions row into the strings and target numbers the UI shows.
//
// Rendered server-side on purpose: the week view, the 27-week overview, the
// dashboard's "today" card and the activity detail's matched-session line all
// need the same label, and the MCP layer may want it too. One implementation
// means they can't drift.

export type Prescription = Record<string, unknown>;

const TYPE_LABELS: Record<string, string> = {
  easy_run: "Easy run",
  moderate_run: "Moderate run",
  quality_run: "Quality run",
  long_run: "Long run",
  walk_run_or_continuous: "Walk/run",
  marathon: "Marathon",
  "weekly-target": "Weekly target",
};

export function typeLabel(type: string | null | undefined): string {
  if (!type) return "Session";
  return TYPE_LABELS[type] ?? type.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Prescribed distance in metres, or null when the session is prescribed by
 * duration alone (or is race day, which carries a goal and pace instead).
 */
export function targetDistanceM(prescription: Prescription | null | undefined): number | null {
  const p = prescription ?? {};
  const km = num(p.distanceKm) ?? num(p.approxKm);
  return km == null ? null : km * 1000;
}

/** Prescribed duration in seconds, or null when prescribed by distance. */
export function targetDurationS(prescription: Prescription | null | undefined): number | null {
  const p = prescription ?? {};
  const min = num(p.durationMin);
  return min == null ? null : min * 60;
}

/**
 * One line describing what the session asks for. Covers all five prescription
 * shapes the import script produces:
 *   {distanceKm} · {distanceKm,note} · {durationMin,ratio} ·
 *   {durationMin,approxKm} · {goal,pace}
 */
export function sessionLabel(type: string | null | undefined, prescription: Prescription | null | undefined): string {
  const p = prescription ?? {};
  const label = typeLabel(type);

  // Race day.
  const goal = typeof p.goal === "string" ? p.goal : null;
  if (goal) {
    const pace = typeof p.pace === "string" ? p.pace : null;
    return pace ? `${label} · ${goal} (${pace})` : `${label} · ${goal}`;
  }

  // Engine-drafted volume row — a weekly total, not a single session.
  const weekly = num(p.targetWeeklyVolumeM);
  if (weekly != null && p.distanceKm == null && p.durationMin == null) {
    return `${label} · ${(weekly / 1000).toFixed(1)} km for the week`;
  }

  const km = num(p.distanceKm);
  const note = typeof p.note === "string" ? p.note : null;
  if (km != null) {
    const base = `${label} · ${km.toFixed(1)} km`;
    return note ? `${base} (${note})` : base;
  }

  const min = num(p.durationMin);
  if (min != null) {
    const ratio = typeof p.ratio === "string" ? p.ratio : null;
    if (ratio) return `${label} · ${min} min (${ratio} run/walk)`;
    const approx = num(p.approxKm);
    return approx != null ? `${label} · ${min} min (~${approx.toFixed(1)} km)` : `${label} · ${min} min`;
  }

  return label;
}
