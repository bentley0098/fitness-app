import { boolean, date, doublePrecision, integer, jsonb, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// Mirrors adaptive-training-plan-spec.md Section 4 (rewritten in the 9 Sept
// 2026 pivot — Garmin recovery signals replace physio-supplied thresholds).
// Single-user app — no user_id column on any table (see spec Section 2).

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  date: date("date").notNull(),
  activityType: text("activity_type").notNull(),
  // Garmin returns these as floats (e.g. distance "1787.807"), not whole numbers.
  distanceM: doublePrecision("distance_m"),
  movingTimeS: doublePrecision("moving_time_s"),
  elapsedTimeS: doublePrecision("elapsed_time_s"),
  avgHr: doublePrecision("avg_hr"),
  maxHr: doublePrecision("max_hr"),
  cadence: doublePrecision("cadence"),
  elevationM: doublePrecision("elevation_m"),
  // Garmin exposes no VO2-max or training-load endpoint through the Node SDK
  // (its HttpClient is private), but it does return these inside each
  // activity's detail payload — which we already store in raw_payload. So
  // they're extracted on sync and backfilled from stored JSON, no extra API
  // calls. Nullable because Garmin only computes them for qualifying runs.
  vo2Max: doublePrecision("vo2_max"),
  trainingLoad: doublePrecision("training_load"),
  aerobicTe: doublePrecision("aerobic_te"),
  anaerobicTe: doublePrecision("anaerobic_te"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// What the rules engine actually reads. One row per day, upserted (unlike
// activities, a day's wellness data can still change after ingestion).
export const dailyHealthMetrics = pgTable("daily_health_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull().unique(),
  hrvStatus: text("hrv_status"), // balanced | unbalanced | low | unknown
  hrvLastNightAvg: doublePrecision("hrv_last_night_avg"),
  hrvWeeklyAvg: doublePrecision("hrv_weekly_avg"),
  restingHr: doublePrecision("resting_hr"),
  bodyBatteryMin: doublePrecision("body_battery_min"),
  bodyBatteryMax: doublePrecision("body_battery_max"),
  stressAvg: doublePrecision("stress_avg"),
  // Garmin's precise daily VO2 max (running), from the max-metrics endpoint.
  // Only set on days Garmin recomputed it — null means "no new value", not zero.
  vo2Max: doublePrecision("vo2_max"),
  // Sleep, from garmin.sleep.getDailySleep(). Display-only — the engine never
  // reads these (see packages/engine/src/types.ts, which deliberately does not
  // carry them). Attributed to the day the night ENDS on, matching Garmin's
  // own dailySleepDTO.calendarDate.
  sleepTimeS: doublePrecision("sleep_time_s"),
  deepSleepS: doublePrecision("deep_sleep_s"),
  lightSleepS: doublePrecision("light_sleep_s"),
  remSleepS: doublePrecision("rem_sleep_s"),
  awakeSleepS: doublePrecision("awake_sleep_s"),
  sleepScore: doublePrecision("sleep_score"),
  // Wall-clock local, NOT UTC — Garmin already applies the device's offset.
  // Stored tz-naive so the value reads back exactly as the watch recorded it.
  sleepStartLocal: timestamp("sleep_start_local"),
  sleepEndLocal: timestamp("sleep_end_local"),
  rawPayload: jsonb("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Garmin's race-time predictions, one snapshot per day. Display-only.
export const racePredictions = pgTable("race_predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull().unique(),
  time5kS: doublePrecision("time_5k_s"),
  time10kS: doublePrecision("time_10k_s"),
  timeHalfS: doublePrecision("time_half_s"),
  timeMarathonS: doublePrecision("time_marathon_s"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Optional and purely informational — the engine never reads this table.
// Replaces the old pain/limp/RPE `symptoms` design (never built; superseded
// before Phase 2 started).
export const dailyNotes = pgTable("daily_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull().unique(),
  note: text("note"),
  rpe: smallint("rpe"), // 1-10, optional
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planSessions = pgTable("plan_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  phase: text("phase").notNull(),
  type: text("type").notNull(),
  prescription: jsonb("prescription").notNull(),
  cap: jsonb("cap").notNull(),
  status: text("status").notNull().default("planned"), // planned | completed | skipped
  revision: integer("revision").notNull().default(1),
  changedBecause: text("changed_because"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const planRevisions = pgTable("plan_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  planSessionId: uuid("plan_session_id")
    .notNull()
    .references(() => planSessions.id, { onDelete: "cascade" }),
  engineVerdict: text("engine_verdict").notNull(), // progress | hold | regress | stop
  proposed: jsonb("proposed").notNull(),
  applied: boolean("applied").notNull().default(false),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A set of operations Claude has proposed against the plan. Nothing here
// touches plan_sessions until the proposal is approved in the app; the MCP
// can create these but has no way to apply or reject them.
export const planProposals = pgTable("plan_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  rationale: text("rationale").notNull(),
  // Ordered list of operations, each carrying the revision and date of the
  // session it was made against (see server/utils/planProposal.ts).
  operations: jsonb("operations").notNull(),
  engineVerdict: text("engine_verdict").notNull(),
  // The rows and weekly volume as they looked when proposed, so a decided
  // proposal is not re-judged against a plan that has moved on.
  preview: jsonb("preview"),
  // pending | applied | rejected | superseded. Expiry is derived at read time
  // from the operations' dates, never stored.
  status: text("status").notNull().default("pending"),
  statusNote: text("status_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

// Strength work. An exercise is a movement with a stable identity, so its
// history can be followed across sessions and templates. name_key is the
// case- and whitespace-insensitive form of the name (see exerciseKey in
// server/utils/strength.ts) and is what uniqueness is enforced on.
export const exercises = pgTable("exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  measure: text("measure").notNull().default("reps"), // reps | hold
  perSide: boolean("per_side").notNull().default(false),
  note: text("note"),
  restSeconds: integer("rest_seconds"), // null = the app default
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A reusable, named, ordered list of exercises a strength session is started
// from. Carries sets and reps (or hold time) per exercise, never a weight —
// weight always comes from the last logged set.
export const strengthTemplates = pgTable("strength_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  nameKey: text("name_key").notNull().unique(),
  kind: text("kind").notNull(), // gym | physio
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const strengthTemplateSlots = pgTable("strength_template_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => strengthTemplates.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  sets: integer("sets").notNull(),
  repsMin: integer("reps_min"),
  repsMax: integer("reps_max"),
  holdSeconds: integer("hold_seconds"),
  restSeconds: integer("rest_seconds"),
  // Consecutive slots sharing a number are a superset.
  supersetGroup: integer("superset_group"),
  note: text("note"),
});

// The strength log: the runner's own record of a strength session. Starting one
// copies the template's exercises into strength_log_exercises, so adding,
// removing and swapping exercises mid-session never touches the template.
export const strengthLogs = pgTable("strength_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  kind: text("kind").notNull(), // gym | physio
  templateId: uuid("template_id").references(() => strengthTemplates.id, { onDelete: "set null" }),
  // Kept so history still reads right if the template is later renamed or deleted.
  templateName: text("template_name").notNull(),
  // The planned session this log was started from, if any.
  planSessionId: uuid("plan_session_id").references(() => planSessions.id, { onDelete: "set null" }),
  status: text("status").notNull().default("in_progress"), // in_progress | finished
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const strengthLogExercises = pgTable("strength_log_exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  logId: uuid("log_id")
    .notNull()
    .references(() => strengthLogs.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  exerciseId: uuid("exercise_id")
    .notNull()
    .references(() => exercises.id),
  // How many set rows this exercise has in this session.
  sets: integer("sets").notNull(),
  repsMin: integer("reps_min"),
  repsMax: integer("reps_max"),
  holdSeconds: integer("hold_seconds"),
  restSeconds: integer("rest_seconds"),
  supersetGroup: integer("superset_group"),
  note: text("note"),
});

// Only sets that were actually done have a row; the rest of a session's rows
// are derived from the exercise's set count.
export const strengthLogSets = pgTable(
  "strength_log_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    logExerciseId: uuid("log_exercise_id")
      .notNull()
      .references(() => strengthLogExercises.id, { onDelete: "cascade" }),
    setIndex: integer("set_index").notNull(),
    reps: integer("reps"),
    holdSeconds: integer("hold_seconds"),
    weightKg: doublePrecision("weight_kg"), // null = bodyweight
    loggedAt: timestamp("logged_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ onePerSet: unique("strength_log_sets_exercise_set_unique").on(t.logExerciseId, t.setIndex) }),
);

// Not part of the spec's core tables — infrastructure for the Garmin
// ingestion mechanism (Section 3 update). Single row, keyed by a fixed id,
// holding the OAuth token pair so the sync cron never needs an interactive
// re-login.
export const garminTokens = pgTable("garmin_tokens", {
  id: text("id").primaryKey().default("default"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  tokenType: text("token_type"),
  scope: text("scope"),
  displayName: text("display_name"),
  clientId: text("client_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Minimal single-user OAuth 2.1 authorization server for the MCP endpoint
// (server/routes/oauth/*), so claude.ai's custom-connector UI — which
// requires OAuth, not a plain bearer header — can complete its flow. Not
// part of the core domain model.

// Dynamic Client Registration (RFC 7591). Public clients only — no secret,
// PKCE does the work a client secret would otherwise do.
export const oauthClients = pgTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientName: text("client_name"),
  redirectUris: jsonb("redirect_uris").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Short-lived, single-use authorization codes (PKCE challenge stored here,
// verified against code_verifier at the token endpoint).
export const oauthCodes = pgTable("oauth_codes", {
  code: text("code").primaryKey(),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull(),
  resource: text("resource"),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Access tokens are short-lived; refresh tokens rotate on every use (OAuth
// 2.1 requirement for public clients) — old row is deleted, not reused.
export const oauthTokens = pgTable("oauth_tokens", {
  accessToken: text("access_token").primaryKey(),
  refreshToken: text("refresh_token").notNull().unique(),
  clientId: text("client_id").notNull(),
  resource: text("resource"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Renamed from physio_params in the 9 Sept 2026 pivot. Same "rules as data"
// shape, but self-authored from standard sports-science defaults rather than
// physio-supplied — see spec Section 4/5.
export const engineParams = pgTable("engine_params", {
  id: uuid("id").defaultRandom().primaryKey(),
  version: integer("version").notNull(),
  workloadRatioSweetSpotMin: doublePrecision("workload_ratio_sweet_spot_min").notNull(),
  workloadRatioSweetSpotMax: doublePrecision("workload_ratio_sweet_spot_max").notNull(),
  workloadRatioDangerZone: doublePrecision("workload_ratio_danger_zone").notNull(),
  weeklyVolumeIncreaseCapPct: doublePrecision("weekly_volume_increase_cap_pct").notNull(),
  consecutiveCleanWeeksToProgress: integer("consecutive_clean_weeks_to_progress").notNull(),
  consecutiveCleanWeeksToUnlockPhase: integer("consecutive_clean_weeks_to_unlock_phase").notNull(),
  restingHrSpikeThreshold: doublePrecision("resting_hr_spike_threshold").notNull(),
  bodyBatteryFloor: doublePrecision("body_battery_floor").notNull(),
  reassessmentIntervalDays: integer("reassessment_interval_days").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
