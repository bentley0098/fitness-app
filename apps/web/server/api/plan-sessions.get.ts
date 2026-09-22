import { buildOverview, buildWeek, loadPlanSnapshot, raceInfo } from "../utils/planView";
import { toPlanSessionDto } from "../utils/serialize";

// Three modes:
//   ?week=<any ISO date>  one week, snapped to its ISO Monday (the default,
//                         using today when no date is given)
//   ?view=overview        all 27 weeks, aggregated
//   ?view=all             the flat list this route used to return — now
//                         camelCase, with labels and targets resolved
//
// The old default (99 raw snake_case rows) is preserved as ?view=all. The MCP
// server is unaffected: server/mcp/createServer.ts queries plan_sessions
// directly rather than going through this route.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const view = typeof query.view === "string" ? query.view : null;
  const snapshot = await loadPlanSnapshot();

  if (view === "overview") return buildOverview(snapshot);

  if (view === "all") {
    return {
      race: raceInfo(snapshot.today),
      sessions: snapshot.sessions.map((s) => toPlanSessionDto(s as Record<string, any>)),
    };
  }

  const week = typeof query.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.week) ? query.week : snapshot.today;

  return {
    race: raceInfo(snapshot.today),
    ...buildWeek(snapshot, week),
  };
});
