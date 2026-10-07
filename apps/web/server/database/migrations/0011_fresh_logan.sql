CREATE TABLE IF NOT EXISTS "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"measure" text DEFAULT 'reps' NOT NULL,
	"per_side" boolean DEFAULT false NOT NULL,
	"note" text,
	"rest_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercises_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "strength_template_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
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
CREATE TABLE IF NOT EXISTS "strength_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "strength_templates_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_template_slots" ADD CONSTRAINT "strength_template_slots_template_id_strength_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."strength_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "strength_template_slots" ADD CONSTRAINT "strength_template_slots_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
