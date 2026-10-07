CREATE TABLE IF NOT EXISTS "plan_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rationale" text NOT NULL,
	"operations" jsonb NOT NULL,
	"engine_verdict" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
