CREATE TABLE IF NOT EXISTS "daily_health_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"hrv_status" text,
	"hrv_last_night_avg" double precision,
	"hrv_weekly_avg" double precision,
	"resting_hr" double precision,
	"body_battery_min" double precision,
	"body_battery_max" double precision,
	"stress_avg" double precision,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_health_metrics_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "daily_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"rpe" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_notes_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine_params" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"workload_ratio_sweet_spot_min" double precision NOT NULL,
	"workload_ratio_sweet_spot_max" double precision NOT NULL,
	"workload_ratio_danger_zone" double precision NOT NULL,
	"weekly_volume_increase_cap_pct" double precision NOT NULL,
	"consecutive_clean_weeks_to_progress" integer NOT NULL,
	"consecutive_clean_weeks_to_unlock_phase" integer NOT NULL,
	"resting_hr_spike_threshold" double precision NOT NULL,
	"body_battery_floor" double precision NOT NULL,
	"reassessment_interval_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
