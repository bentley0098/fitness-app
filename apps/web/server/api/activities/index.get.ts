import { db } from "../../utils/db";
import { selectTolerant } from "../../utils/optionalColumns";
import { ACTIVITY_BASE_COLUMNS, ACTIVITY_COLUMNS, toActivityDto } from "../../utils/serialize";
import { sessionLabel } from "../../utils/planLabels";
import { countsToward, sessionForEachActivity, sessionsByDate } from "../../utils/planCompletion";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const limit = Math.min(Math.max(Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

  const build = (cols: string) => {
    let request = db
      .from("activities")
      .select(cols, { count: "exact" })
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (typeof query.type === "string" && query.type) request = request.eq("activity_type", query.type);
    if (typeof query.from === "string" && query.from) request = request.gte("date", query.from);
    if (typeof query.to === "string" && query.to) request = request.lte("date", query.to);
    return request;
  };

  const { data, error, count } = (await selectTolerant(
    "activities",
    ACTIVITY_COLUMNS,
    ACTIVITY_BASE_COLUMNS,
    build,
  )) as { data: any[] | null; error: any; count?: number | null };
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const rows = data ?? [];

  // Annotate each run with the session it satisfies, if any. Scoped to the
  // dates actually on this page rather than loading the whole plan.
  const dates = [...new Set(rows.map((r) => r.date))];
  const matchedSession = new Map<string, Record<string, any>>();

  if (dates.length) {
    const [{ data: sessions }, { data: dayActivities }] = await Promise.all([
      db.from("plan_sessions").select("*").in("date", dates),
      db.from("activities").select("id, date, activity_type, distance_m, moving_time_s").in("date", dates),
    ]);
    const sessionsOn = sessionsByDate((sessions ?? []) as any[]);
    for (const [date, onDay] of sessionsOn) {
      const activitiesOn = (dayActivities ?? []).filter((a: any) => a.date === date);
      for (const [activityId, session] of sessionForEachActivity(onDay as any[], activitiesOn as any[])) {
        matchedSession.set(activityId, session as Record<string, any>);
      }
    }
  }

  return {
    activities: rows.map((r) => {
      const session = matchedSession.get(r.id);
      const matched = session && countsToward(r as any, session.type);
      return {
        ...toActivityDto(r),
        planSessionId: matched ? session.id : null,
        planSessionLabel: matched ? sessionLabel(session.type, session.prescription) : null,
      };
    }),
    total: count ?? rows.length,
    limit,
    offset,
  };
});
