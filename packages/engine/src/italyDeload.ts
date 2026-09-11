// Hard-coded per adaptive-training-plan-spec.md Section 5 — not derived from
// any signal, and no rule may make up the missed volume afterward.
const DELOAD_START = "2026-09-17";
const DELOAD_END = "2026-09-29";

export function isInItalyDeload(isoDate: string): boolean {
  return isoDate >= DELOAD_START && isoDate <= DELOAD_END;
}
