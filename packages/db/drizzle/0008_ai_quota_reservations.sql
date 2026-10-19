CREATE TABLE "ai_quota_days" (
	"day" timestamp with time zone PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_quota_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" timestamp with time zone NOT NULL,
	"client_hash" text NOT NULL,
	"network_hash" text,
	"signed_in" boolean NOT NULL,
	"reserved_micro_rub" bigint NOT NULL,
	"settled_micro_rub" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_quota_reservations" ADD CONSTRAINT "ai_quota_reservations_day_ai_quota_days_day_fk" FOREIGN KEY ("day") REFERENCES "public"."ai_quota_days"("day") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_quota_reservations_day_client_idx" ON "ai_quota_reservations" USING btree ("day","client_hash");--> statement-breakpoint
CREATE INDEX "ai_quota_reservations_day_network_idx" ON "ai_quota_reservations" USING btree ("day","network_hash") WHERE "ai_quota_reservations"."signed_in" = false;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_request_id_ai_quota_reservations_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ai_quota_reservations"("id") ON DELETE no action ON UPDATE no action;