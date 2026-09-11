CREATE TABLE IF NOT EXISTS "garmin_tokens" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone,
	"token_type" text,
	"scope" text,
	"display_name" text,
	"client_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
