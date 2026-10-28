CREATE TABLE "design_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wishlist_id" uuid NOT NULL,
	"product" text NOT NULL,
	"amount_kopecks" integer NOT NULL,
	"email" text NOT NULL,
	"payment_id" text,
	"confirmation_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_purchases_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
ALTER TABLE "design_purchases" ADD CONSTRAINT "design_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_purchases" ADD CONSTRAINT "design_purchases_wishlist_id_wishlists_id_fk" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_purchases_list_idx" ON "design_purchases" USING btree ("wishlist_id");