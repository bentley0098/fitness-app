import { db } from "../../utils/db";
import { countsToward, sessionForEachActivity } from "../../utils/planCompletion";
import { toPlanSessionDto, toActivityDto } from "../../utils/serialize";

type Raw = Record<string, any>;

// Fields worth surfacing that only exist inside the stored Garmin blob. The
// blob itself is never returned — it's hundreds of KB per activity.
function extractDetail(raw: unknown) {
  const d = (raw ?? {}) as Raw;
  const summary: Raw = d.summaryDTO ?? {};

  const splits = Array.isArray(d.splitSummaries)
    ? d.splitSummaries
        .filter((s: Raw) => s?.distance != null)
        .map((s: Raw) => ({
          type: s.splitType ?? null,
          distanceM: s.distance ?? null,
          durationS: s.duration ?? null,
          avgHr: s.averageHR ?? null,
          elevationGainM: s.elevationGain ?? null,
        }))
    : null;

  return {
    startTimeLocal: summary.startTimeLocal ?? null,
    calories: summary.calories ?? null,
    avgPower: summary.averagePower ?? null,
    minElevationM: summary.minElevation ?? null,
    maxElevationM: summary.maxElevation ?? null,
    activityName: d.activityName ?? null,
    splits: splits?.length ? splits : null,
  };
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing activity id" });

  // select("*") here is deliberate and the one place it's right — this route
  // needs raw_payload to extract splits, and it's a single row.
  const { data: row, error } = await db.from("activities").select("*").eq("id", id).maybeSingle();

  if (error) throw createError({ statusCode: 500, statusMessage: error.message });
  if (!row) throw createError({ statusCode: 404, statusMessage: "Activity not found" });

  const [{ data: sessions }, { data: dayActivities }, { data: note }] = await Promise.all([
    db.from("plan_sessions").select("*").eq("date", row.date),
    db.from("activities").select("id, date, activity_type, distance_m, moving_time_s").eq("date", row.date),
    db.from("daily_notes").select("note, rpe").eq("date", row.date).maybeSingle(),
  ]);

  // With several runs planned on the day, the activity counts towards the one
  // it is closest to, the same way the plan screen pairs them.
  const session = sessionForEachActivity((sessions ?? []) as any[], (dayActivities ?? []) as any[]).get(row.id) ?? null;
  const matched = session && countsToward(row as any, session.type);

  return {
    ...toActivityDto(row),
    ...extractDetail(row.raw_payload),
    planSession: matched ? toPlanSessionDto(session) : null,
    note: note ? { note: note.note ?? null, rpe: note.rpe ?? null } : null,
  };
});
