CREATE TABLE IF NOT EXISTS "strength_log_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"exercise_id" uuid NOT NULL,
	"sets" integer NOT NULL,
	"reps_min" integer,
	"reps_max" integer,
	"hold_seconds" integer,
	"rest_seconds" integer,
	"superset_group" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strength_log_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_exercise_id" uuid NOT NULL,
	"set_index" integer NOT NULL,
	"reps" integer,
	"hold_seconds" integer,
	"weight_kg" double precision,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strength_log_sets_exercise_set_unique" UNIQUE("log_exercise_id","set_index")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strength_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"template_id" uuid,
	"template_name" text NOT NULL,
	"plan_session_id" uuid,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_log_exercises" ADD CONSTRAINT "strength_log_exercises_log_id_strength_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."strength_logs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_log_exercises" ADD CONSTRAINT "strength_log_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_log_sets" ADD CONSTRAINT "strength_log_sets_log_exercise_id_strength_log_exercises_id_fk" FOREIGN KEY ("log_exercise_id") REFERENCES "public"."strength_log_exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_logs" ADD CONSTRAINT "strength_logs_template_id_strength_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."strength_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_logs" ADD CONSTRAINT "strength_logs_plan_session_id_plan_sessions_id_fk" FOREIGN KEY ("plan_session_id") REFERENCES "public"."plan_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
