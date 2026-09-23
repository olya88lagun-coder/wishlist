CREATE TABLE "store_search_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store" text NOT NULL,
	"source" text NOT NULL,
	"query" text NOT NULL,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "store_search_clicks_time_idx" ON "store_search_clicks" USING btree ("clicked_at");--> statement-breakpoint
CREATE INDEX "store_search_clicks_source_idx" ON "store_search_clicks" USING btree ("source");