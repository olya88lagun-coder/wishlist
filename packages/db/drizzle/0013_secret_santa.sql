CREATE TYPE "public"."santa_game_status" AS ENUM('open', 'drawn');--> statement-breakpoint
CREATE TABLE "santa_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizer_id" uuid NOT NULL,
	"title" text NOT NULL,
	"budget_text" text NOT NULL,
	"exchange_date" date NOT NULL,
	"join_code" text NOT NULL,
	"status" "santa_game_status" DEFAULT 'open' NOT NULL,
	"drawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "santa_games_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "santa_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"wishlist_id" uuid,
	"display_name" text NOT NULL,
	"recipient_participant_id" uuid,
	"personal_token_hash" text,
	"recovery_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "santa_participants_personal_token_hash_unique" UNIQUE("personal_token_hash"),
	CONSTRAINT "santa_participants_recovery_token_hash_unique" UNIQUE("recovery_token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_games" ADD CONSTRAINT "santa_games_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_participants" ADD CONSTRAINT "santa_participants_game_id_santa_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."santa_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_participants" ADD CONSTRAINT "santa_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "santa_participants" ADD CONSTRAINT "santa_participants_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "santa_games_organizer_idx" ON "santa_games" USING btree ("organizer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "santa_participants_game_user_uq" ON "santa_participants" USING btree ("game_id","user_id");--> statement-breakpoint
CREATE INDEX "santa_participants_user_idx" ON "santa_participants" USING btree ("user_id");