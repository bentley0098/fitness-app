import { db } from "../../utils/db";
import { ACTIVITY_COLUMNS, toActivityDto } from "../../utils/serialize";
import { sessionLabel } from "../../utils/planLabels";
import { countsToward } from "../../utils/planCompletion";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const limit = Math.min(Math.max(Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(query.offset ?? 0) || 0, 0);

  let request = db
    .from("activities")
    .select(ACTIVITY_COLUMNS, { count: "exact" })
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (typeof query.type === "string" && query.type) request = request.eq("activity_type", query.type);
  if (typeof query.from === "string" && query.from) request = request.gte("date", query.from);
  if (typeof query.to === "string" && query.to) request = request.lte("date", query.to);

  const { data, error, count } = await request;
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const rows = data ?? [];

  // Annotate each run with the session it satisfies, if any. Scoped to the
  // dates actually on this page rather than loading the whole plan.
  const dates = [...new Set(rows.map((r) => r.date))];
  const sessionsByDate = new Map<string, Record<string, any>>();

  if (dates.length) {
    const { data: sessions } = await db.from("plan_sessions").select("*").in("date", dates);
    for (const s of sessions ?? []) sessionsByDate.set(s.date, s);
  }

  return {
    activities: rows.map((r) => {
      const session = sessionsByDate.get(r.date);
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
