import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evaluate } from "@fitness/engine";
import { z } from "zod";
import { db } from "../utils/db";
import { applyRevision, proposeRevision } from "../utils/planRevisions";
import { addDaysIso, isoDate } from "../utils/dates";
import { loadTrainingWindow } from "../utils/trainingData";

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// Fresh server per request (see server/api/mcp.ts) — stateless transport,
// so there's nothing to gain from a long-lived singleton here, and it keeps
// each call's data as fresh as the moment it was invoked.
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "adaptive-training", version: "1.0.0" });

  server.registerTool(
    "get_training_window",
    {
      description:
        "Merged activity and Garmin health-metric data for the trailing N days, plus the engine's current verdict and reason. Use this before proposing anything — never guess at the numbers.",
      inputSchema: { days: z.number().int().min(1).max(90).default(14) },
    },
    async ({ days }) => {
      const window = await loadTrainingWindow();
      const asOfDate = isoDate(new Date());
      const from = addDaysIso(asOfDate, -(days - 1));

      const evaluation = evaluate(window, asOfDate);

      return textResult({
        asOfDate,
        evaluation,
        activities: window.activities.filter((a) => a.date >= from),
        healthMetrics: window.healthMetrics.filter((m) => m.date >= from),
        engineParams: window.engineParams,
      });
    },
  );

  server.registerTool(
    "get_current_plan",
    { description: "The most recently dated plan_sessions row, whatever its status." },
    async () => {
      const { data, error } = await db.from("plan_sessions").select("*").order("date", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return textResult(data ?? { message: "No plan sessions exist yet." });
    },
  );

  server.registerTool(
    "get_plan_history",
    { description: "All plan_sessions with their full plan_revisions trail, most recent first." },
    async () => {
      const { data, error } = await db
        .from("plan_sessions")
        .select("*, plan_revisions(*)")
        .order("date", { ascending: false });
      if (error) throw new Error(error.message);
      return textResult(data ?? []);
    },
  );

  server.registerTool(
    "propose_revision",
    {
      description:
        "Propose a revision to a plan session. The target weekly volume is clamped by the engine regardless of what's asked for — the returned clampedWeeklyVolumeM is what actually gets written, not requestedWeeklyVolumeM. Writes a 'pending' plan_sessions row and a plan_revisions audit row; nothing is applied until apply_revision is called with explicit human approval.",
      inputSchema: {
        date: z.string().describe("ISO date this session/week targets"),
        phase: z.string(),
        type: z.string(),
        targetWeeklyVolumeM: z.number().positive(),
        prescription: z.record(z.unknown()).optional(),
        cap: z.record(z.unknown()).optional(),
        rationale: z.string().describe("Human-readable reason, surfaced in the app UI"),
      },
    },
    async (input) => textResult(await proposeRevision(input)),
  );

  server.registerTool(
    "apply_revision",
    {
      description: "Apply a previously proposed revision. Only call this after explicit human approval — never on your own initiative.",
      inputSchema: { planRevisionId: z.string() },
    },
    async ({ planRevisionId }) => textResult(await applyRevision(planRevisionId)),
  );

  return server;
}
