CREATE TABLE "wishlist_deletion_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wishlist_id" uuid NOT NULL,
	"guest_user_id" uuid NOT NULL,
	"wishlist_title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"outcome" text
);
--> statement-breakpoint
ALTER TABLE "wishlist_deletion_notices" ADD CONSTRAINT "wishlist_deletion_notices_guest_user_id_users_id_fk" FOREIGN KEY ("guest_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_deletion_notices_once_uq" ON "wishlist_deletion_notices" USING btree ("wishlist_id","guest_user_id");--> statement-breakpoint
CREATE INDEX "wishlist_deletion_notices_pending_idx" ON "wishlist_deletion_notices" USING btree ("available_at") WHERE "wishlist_deletion_notices"."completed_at" is null;