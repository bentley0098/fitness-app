CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"date" date NOT NULL,
	"activity_type" text NOT NULL,
	"distance_m" integer,
	"moving_time_s" integer,
	"elapsed_time_s" integer,
	"avg_hr" integer,
	"max_hr" integer,
	"cadence" integer,
	"elevation_m" integer,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "physio_params" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"pain_ceiling" smallint NOT NULL,
	"morning_pain_threshold" smallint NOT NULL,
	"consecutive_clean_sessions_to_progress" integer NOT NULL,
	"weekly_volume_cap_m" integer NOT NULL,
	"phase_unlocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reassessment_interval_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_session_id" uuid NOT NULL,
	"engine_verdict" text NOT NULL,
	"proposed" jsonb NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"phase" text NOT NULL,
	"type" text NOT NULL,
	"prescription" jsonb NOT NULL,
	"cap" jsonb NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"changed_because" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "symptoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"pain_during" smallint NOT NULL,
	"pain_next_morning" smallint NOT NULL,
	"limp" boolean NOT NULL,
	"rpe" smallint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "symptoms_date_unique" UNIQUE("date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plan_revisions" ADD CONSTRAINT "plan_revisions_plan_session_id_plan_sessions_id_fk" FOREIGN KEY ("plan_session_id") REFERENCES "public"."plan_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
