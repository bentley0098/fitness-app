import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { evaluate } from "@fitness/engine";
import { z } from "zod";
import type { OperationRequest } from "../utils/planProposal";
import { ProposalError, createProposal, loadPlanLibrary, loadPlannerSessions, pendingProposalIdsBySession } from "../utils/planProposals";
import { DEFAULT_ZONE, addDaysIso, mondayOf, today } from "../../shared/utils/calendar";
import { loadTrainingWindow } from "../utils/trainingData";
import { listLogs, loadStrengthHistory, loadStrengthLogsLike } from "../utils/strengthLogs";
import { listTemplates, loadExercises, viewTemplate } from "../utils/strengthStore";
import { isStrengthType } from "../utils/planLabels";

const slotSchema = z.object({
  exercise: z.string().describe("Exercise name, from get_exercises or one added in the same proposal"),
  sets: z.number().int().min(1),
  repsMin: z.number().int().min(1).nullish().describe("For reps exercises: reps per set, or the bottom of a range"),
  repsMax: z.number().int().min(1).nullish().describe("Top of a rep range; leave out for a fixed number"),
  holdSeconds: z.number().int().min(1).nullish().describe("For timed holds: seconds per set"),
  restSeconds: z.number().int().min(0).nullish(),
  supersetGroup: z.number().int().nullish().describe("Consecutive slots sharing a number are a superset"),
  note: z.string().nullish(),
});

const exerciseOpFields = {
  name: z.string(),
  measure: z.enum(["reps", "hold"]).describe("reps (with an optional weight the runner enters) or a timed hold"),
  perSide: z.boolean().optional(),
  note: z.string().nullish(),
  restSeconds: z.number().int().min(0).nullish(),
};

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

// Fresh server per request (see server/api/mcp.ts) — stateless transport,
// so there's nothing to gain from a long-lived singleton here, and it keeps
// each call's data as fresh as the moment it was invoked.
export function createMcpServer(appOrigin = ""): McpServer {
  const server = new McpServer({ name: "adaptive-training", version: "1.0.0" });
  // No device behind an MCP call, so Today is Irish time.
  const todayNow = () => today(new Date(), DEFAULT_ZONE);

  async function proposeAndReport(requests: OperationRequest[], rationale: string) {
    try {
      const created = await createProposal(requests, rationale, todayNow());
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
      const asOfDate = todayNow();
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
        "Planned sessions between two ISO dates (inclusive), each with its id, date, phase, type, prescription, cap, status, revision and the ids of any pending proposals already touching it. Several sessions can share a date. Strength sessions have type strength_gym or strength_physio, name their template in the prescription, and carry a `log` (status and sets done) once the runner has started them. Use the id when proposing a change.",
      inputSchema: { from: z.string().describe("ISO date, inclusive"), to: z.string().describe("ISO date, inclusive") },
    },
    async ({ from, to }) => {
      const [all, pending, logs, summaries] = await Promise.all([
        loadPlannerSessions(),
        pendingProposalIdsBySession(todayNow()),
        loadStrengthLogsLike(),
        listLogs(200),
      ]);
      const summaryById = new Map(summaries.map((l) => [l.id, l]));
      const sessions = all
        .filter((s) => s.date >= from && s.date <= to)
        .map((s) => {
          const base = { ...s, pendingProposalIds: pending.get(s.id) ?? [] };
          if (!isStrengthType(s.type)) return base;
          // A strength session's record is the log started from it, not an activity.
          const started = logs.filter((l) => l.planSessionId === s.id);
          const linked = started.find((l) => l.status === "finished") ?? started[0];
          const summary = linked ? summaryById.get(linked.id) : undefined;
          return { ...base, log: linked ? { id: linked.id, status: linked.status, date: linked.date, setsDone: summary?.setsDone ?? 0 } : null };
        });
      return textResult(sessions);
    },
  );

  server.registerTool(
    "get_exercises",
    {
      description:
        "The exercise library: every exercise with its id, name, measure (reps with an optional weight, or a timed hold), whether it is per side, its note and default rest. Use the ids when asking for history.",
      inputSchema: {},
    },
    async () => textResult(await loadExercises()),
  );

  server.registerTool(
    "get_templates",
    {
      description:
        "Strength templates (kind gym or physio), each with its ordered exercises, the sets and rep range or hold time asked of each, rest, notes and which exercises form a superset. Templates carry no weight: weight is whatever the runner last lifted.",
      inputSchema: {},
    },
    async () => {
      const summaries = await listTemplates();
      const templates = await Promise.all(summaries.map((t) => viewTemplate(t.id)));
      return textResult(templates.filter((t) => t !== null));
    },
  );

  server.registerTool(
    "get_strength_history",
    {
      description:
        "Finished strength sessions, newest first, with every set the runner logged (reps, weight in kg, or hold seconds). Narrow it with an exerciseId (from get_exercises) and/or an ISO date range. This is the runner's own record, so read it before proposing anything about their strength work.",
      inputSchema: {
        exerciseId: z.string().optional(),
        from: z.string().optional().describe("ISO date, inclusive"),
        to: z.string().optional().describe("ISO date, inclusive"),
      },
    },
    async ({ exerciseId, from, to }) => textResult(await loadStrengthHistory({ exerciseId, from, to })),
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
    "propose_add_exercise",
    {
      description:
        "Propose adding an exercise to the library, so templates can use it. This never changes anything: the runner approves it in the app. Templates carry no weight, so only name how it is counted: reps (the runner enters any weight themself) or a timed hold.",
      inputSchema: { ...exerciseOpFields, rationale: z.string().describe("Human-readable reason, shown on the proposal screen") },
    },
    async ({ rationale, ...exercise }) => proposeAndReport([{ kind: "addExercise", ...exercise }], rationale),
  );

  server.registerTool(
    "propose_create_template",
    {
      description:
        "Propose a new strength template (kind gym or physio): an ordered list of exercises with sets and reps or hold time. Templates never carry a weight, and you must not propose loads: the runner chooses their own weights in the gym. Every exercise must already exist (get_exercises) or be added in the same proposal with propose_week. Consecutive slots sharing a supersetGroup form a superset.",
      inputSchema: {
        name: z.string(),
        templateKind: z.enum(["gym", "physio"]),
        slots: z.array(slotSchema).min(1),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ rationale, ...template }) => proposeAndReport([{ kind: "createTemplate", ...template }], rationale),
  );

  server.registerTool(
    "propose_update_template",
    {
      description:
        "Propose changing a template: rename it and/or replace its whole list of exercises (send every slot you want it to have). Refused if the runner has edited the template since you read it. Never propose weights.",
      inputSchema: {
        templateId: z.string().describe("From get_templates"),
        name: z.string().optional(),
        slots: z.array(slotSchema).min(1).optional(),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ rationale, ...template }) => proposeAndReport([{ kind: "updateTemplate", ...template }], rationale),
  );

  server.registerTool(
    "propose_add_strength_session",
    {
      description:
        "Propose scheduling a strength session from an existing template on a date. A date can already hold other sessions, including a run. This never changes the plan: the runner approves it in the app. The session's type follows the template's kind. To schedule from a template that does not exist yet, use propose_week with a createTemplate and an add operation instead.",
      inputSchema: {
        date: z.string().describe("ISO date for the session"),
        templateName: z.string().describe("A template name from get_templates"),
        phase: z.string().optional().describe("Defaults to the phase of that week's runs"),
        rationale: z.string().describe("Human-readable reason, shown on the proposal screen"),
      },
    },
    async ({ date, templateName, phase, rationale }) => {
      const [library, sessions] = await Promise.all([loadPlanLibrary(), loadPlannerSessions()]);
      const template = library.templates.find((t) => t.name.trim().toLowerCase() === templateName.trim().toLowerCase());
      if (!template) {
        return { content: [{ type: "text" as const, text: `There is no template called "${templateName}".` }], isError: true };
      }
      const week = mondayOf(date);
      const weekPhase = sessions.find((x) => mondayOf(x.date) === week && !x.type.startsWith("strength_"))?.phase;
      return proposeAndReport(
        [{ kind: "add", date, phase: phase ?? weekPhase ?? "base", type: template.kind === "gym" ? "strength_gym" : "strength_physio", prescription: { templateName: template.name } }],
        rationale,
      );
    },
  );

  server.registerTool(
    "propose_week",
    {
      description:
        "Propose several changes at once as ONE proposal, so a reworked week needs a single approval. Each operation is an update (sessionId + patch), move (sessionId + toDate), add (a new session) or remove (sessionId), or a change to the strength library: addExercise, createTemplate (templateKind + slots) or updateTemplate (templateId). A strength session is an add with type strength_gym or strength_physio and prescription {templateName}, which can name a template created in the same proposal; its operations are applied in order, library changes first. Never propose weights. Everything applies together or not at all. This never changes the plan: the runner approves or rejects the whole proposal in the app. Returns a link and the weekly volume before and after for each affected week.",
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
              z.object({ kind: z.literal("addExercise"), ...exerciseOpFields }),
              z.object({ kind: z.literal("createTemplate"), name: z.string(), templateKind: z.enum(["gym", "physio"]), slots: z.array(slotSchema).min(1) }),
              z.object({ kind: z.literal("updateTemplate"), templateId: z.string(), name: z.string().optional(), slots: z.array(slotSchema).min(1).optional() }),
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
