import { boolean, date, doublePrecision, integer, jsonb, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
  rawPayload: jsonb("raw_payload"),
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
  status: text("status").notNull().default("planned"), // planned | pending | completed | skipped
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
