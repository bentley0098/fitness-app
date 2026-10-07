import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evaluate } from "@fitness/engine";
import { z } from "zod";
import type { OperationRequest } from "../utils/planProposal";
import { ProposalError, createProposal, loadPlannerSessions, pendingProposalIdsBySession } from "../utils/planProposals";
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
        "Planned sessions between two ISO dates (inclusive), each with its id, date, phase, type, prescription, cap, status, revision and the ids of any pending proposals already touching it. Use the id when proposing a change.",
      inputSchema: { from: z.string().describe("ISO date, inclusive"), to: z.string().describe("ISO date, inclusive") },
    },
    async ({ from, to }) => {
      const [all, pending] = await Promise.all([loadPlannerSessions(), pendingProposalIdsBySession()]);
      const sessions = all
        .filter((s) => s.date >= from && s.date <= to)
        .map((s) => ({ ...s, pendingProposalIds: pending.get(s.id) ?? [] }));
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
    "propose_week",
    {
      description:
        "Propose several changes at once as ONE proposal, so a reworked week needs a single approval. Each operation is an update (sessionId + patch), move (sessionId + toDate), add (a new session) or remove (sessionId). Everything applies together or not at all. This never changes the plan: the runner approves or rejects the whole proposal in the app. Returns a link and the weekly volume before and after for each affected week.",
      inputSchema: {
        operations: z
          .array(
            z.discriminatedUnion("kind", [
              z.object({
                kind: z.literal("update"),
                sessionId: z.string(),
                patch: z.object({
                  type: z.string().optional(),
                  phase: z.string().optional(),
                  prescription: z.record(z.unknown()).optional(),
                  cap: z.record(z.unknown()).optional(),
                  notes: z.string().optional(),
                }),
              }),
              z.object({ kind: z.literal("move"), sessionId: z.string(), toDate: z.string() }),
              z.object({
                kind: z.literal("add"),
                date: z.string(),
                phase: z.string(),
                type: z.string(),
                prescription: z.record(z.unknown()),
                cap: z.record(z.unknown()).optional(),
              }),
              z.object({ kind: z.literal("remove"), sessionId: z.string() }),
            ]),
          )
          .min(1),
        rationale: z.string().describe("Human-readable reason for the whole change, shown on the proposal screen"),
      },
    },
    async ({ operations, rationale }) => proposeAndReport(operations, rationale),
  );

  return server;
}
