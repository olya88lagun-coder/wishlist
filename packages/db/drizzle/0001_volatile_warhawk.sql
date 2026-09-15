CREATE TABLE "parse_cache" (
	"normalized_url" text PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
