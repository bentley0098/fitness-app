ALTER TABLE "activities" ADD COLUMN "vo2_max" double precision;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "training_load" double precision;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "aerobic_te" double precision;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "anaerobic_te" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "sleep_time_s" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "deep_sleep_s" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "light_sleep_s" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "rem_sleep_s" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "awake_sleep_s" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "sleep_score" double precision;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "sleep_start_local" timestamp;--> statement-breakpoint
ALTER TABLE "daily_health_metrics" ADD COLUMN "sleep_end_local" timestamp;