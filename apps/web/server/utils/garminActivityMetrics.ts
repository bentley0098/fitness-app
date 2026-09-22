import { nonNegative } from "./garminValues";

// Pulls VO2 max and training-load fields out of a Garmin activity detail
// payload.
//
// Why this exists as its own module: the Node SDK has no VO2-max, training-
// load, training-status or training-readiness endpoint — its HttpClient is
// private, so undocumented endpoints are unreachable (see
// adaptive-training-plan-spec.md:99). Garmin does, however, embed these values
// in each activity's detail response, which we already persist wholesale into
// activities.raw_payload. That means the exact same extraction serves two
// callers: syncGarmin.ts on ingest, and the backfill script reading stored
// JSON for activities ingested before these columns existed.
//
// Garmin only computes VO2 max for qualifying outdoor runs with heart rate, so
// null is the common case rather than an error.
type Raw = Record<string, any>;

export interface ActivityMetricColumns {
  vo2_max: number | null;
  training_load: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
}

export function extractActivityMetrics(detail: unknown): ActivityMetricColumns {
  const d = (detail ?? {}) as Raw;
  const summary: Raw = d.summaryDTO ?? {};

  return {
    // Casing is Garmin's, not a typo: lowercase v, capital O.
    vo2_max: nonNegative(summary.vO2MaxValue ?? d.vO2MaxValue),
    training_load: nonNegative(summary.activityTrainingLoad ?? d.activityTrainingLoad),
    aerobic_te: nonNegative(summary.aerobicTrainingEffect ?? d.aerobicTrainingEffect),
    anaerobic_te: nonNegative(summary.anaerobicTrainingEffect ?? d.anaerobicTrainingEffect),
  };
}

/** True when there's at least one value worth writing. */
export function hasAnyMetric(m: ActivityMetricColumns): boolean {
  return m.vo2_max != null || m.training_load != null || m.aerobic_te != null || m.anaerobic_te != null;
}
