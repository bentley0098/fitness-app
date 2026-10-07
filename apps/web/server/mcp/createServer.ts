import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evaluate } from "@fitness/engine";
import { z } from "zod";
import { db } from "../utils/db";
import { applyRevision, proposeRevision } from "../utils/planRevisions";
import type { OperationRequest } from "../utils/planProposal";
import { ProposalError, createProposal, loadPlannerSessions } from "../utils/planProposals";
import { addDaysIso, isoDate } from "../utils/dates";
import { loadTrainingWindow } from "../utils/trainingData";

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// Fresh server per request (see server/api/mcp.ts) — stateless transport,
// so there's nothing to gain from a long-lived singleton here, and it keeps
// each call's data as fresh as the moment it was invoked.
export function createMcpServer(appOrigin = ""): McpServer {
  const server = new McpServer({ name: "adaptive-training", version: "1.0.0" });

  async function proposeAndReport(requests: OperationRequest[], rationale: string) {
    try {
      const created = await createProposal(requests, rationale);
      return textResult({ ...created, link: `${appOrigin}/proposal/${created.proposalId}` });
    } catch (e) {
      if (e instanceof ProposalError) return { content: [{ type: "text" as const, text: e.message }], isError: true };
      throw e;
    }
  }

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
    "get_sessions",
    {
      description:
        "Planned sessions between two ISO dates (inclusive), each with its id, date, phase, type, prescription, cap, status and revision. Use the id when proposing a change.",
      inputSchema: { from: z.string().describe("ISO date, inclusive"), to: z.string().describe("ISO date, inclusive") },
    },
    async ({ from, to }) => {
      const sessions = (await loadPlannerSessions()).filter((s) => s.date >= from && s.date <= to);
      return textResult(sessions);
    },
  );

  server.registerTool(
    "propose_session_change",
    {
      description:
        "Propose a change to one planned session. This never changes the plan: it stores a proposal that the runner approves or rejects in the app. You cannot apply it. patch.prescription is merged into the existing prescription, so send only the fields that change (e.g. {distanceKm: 8}). Status cannot be changed. Returns a link to the proposal and the weekly volume before and after.",
      inputSchema: {
        sessionId: z.string(),
        patch: z.object({
          type: z.string().optional(),
          phase: z.string().optional(),
          prescription: z.record(z.unknown()).optional(),
          cap: z.record(z.unknown()).optional(),
          notes: z.string().optional(),
        }),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ sessionId, patch, rationale }) => proposeAndReport([{ kind: "update", sessionId, patch }], rationale),
  );

  server.registerTool(
    "propose_move",
    {
      description:
        "Propose moving a planned session to another date, in this week or any other. If the target day already has a session, the two swap. This never changes the plan: it stores a proposal the runner approves or rejects in the app. Returns a link and the weekly volume before and after for each affected week.",
      inputSchema: {
        sessionId: z.string(),
        toDate: z.string().describe("ISO date to move the session to"),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ sessionId, toDate, rationale }) => proposeAndReport([{ kind: "move", sessionId, toDate }], rationale),
  );

  server.registerTool(
    "propose_add_session",
    {
      description:
        "Propose adding a new session on a date that has no session. This never changes the plan: it stores a proposal the runner approves or rejects in the app.",
      inputSchema: {
        date: z.string().describe("ISO date for the new session"),
        phase: z.string(),
        type: z.string().describe("e.g. easy_run, long_run, quality_run"),
        prescription: z.record(z.unknown()).describe("e.g. {distanceKm: 5, pace: \"6:00\"}"),
        cap: z.record(z.unknown()).optional(),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ rationale, ...session }) => proposeAndReport([{ kind: "add", ...session }], rationale),
  );

  server.registerTool(
    "propose_remove_session",
    {
      description:
        "Propose removing a planned session (for example to skip it). This never changes the plan: it stores a proposal the runner approves or rejects in the app. Completed or skipped status is the runner's record of what happened and is never set by proposals.",
      inputSchema: {
        sessionId: z.string(),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ sessionId, rationale }) => proposeAndReport([{ kind: "remove", sessionId }], rationale),
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
