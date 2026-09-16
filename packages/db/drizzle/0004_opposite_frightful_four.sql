CREATE TABLE "feature_interest" (
	"user_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_interest" ADD CONSTRAINT "feature_interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_interest_user_feature_uq" ON "feature_interest" USING btree ("user_id","feature");