CREATE TABLE IF NOT EXISTS "race_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"time_5k_s" double precision,
	"time_10k_s" double precision,
	"time_half_s" double precision,
	"time_marathon_s" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "race_predictions_date_unique" UNIQUE("date")
);
--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "vo2_max" double precision;