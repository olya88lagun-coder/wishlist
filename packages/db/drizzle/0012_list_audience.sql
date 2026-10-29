CREATE TYPE "public"."wishlist_audience" AS ENUM('adult', 'child');--> statement-breakpoint
ALTER TABLE "wishlists" ADD COLUMN "audience" "wishlist_audience";