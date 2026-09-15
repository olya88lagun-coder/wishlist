import { generateSlug } from "@wishlist/core";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { isUniqueViolation, isUuid } from "./errors";
import { MAX_WISHLISTS_PER_USER } from "./limits";
import { items, occasionEnum, wishlists } from "./schema";
import type { Database } from "./types";

export type WishlistOccasion = (typeof occasionEnum.enumValues)[number];
export type WishlistInput = { title: string; occasion: WishlistOccasion; eventDate: string | null };
export type WishlistSummary = {
  id: string;
  title: string;
  occasion: WishlistOccasion;
  eventDate: string | null;
  slug: string;
  itemCount: number;
};

const SLUG_ATTEMPTS = 3;

const summaryColumns = {
  id: wishlists.id,
  title: wishlists.title,
  occasion: wishlists.occasion,
  eventDate: wishlists.eventDate,
  slug: wishlists.slug,
  itemCount: sql<number>`count(${items.id})::int`,
};

function summaryQuery(db: Database) {
  return db
    .select(summaryColumns)
    .from(wishlists)
    .leftJoin(items, and(eq(items.wishlistId, wishlists.id), isNull(items.deletedAt)))
    .groupBy(wishlists.id);
}

export async function createWishlist(
  db: Database,
  ownerId: string,
  input: WishlistInput,
): Promise<{ ok: true; wishlist: WishlistSummary } | { ok: false; reason: "LIMIT_REACHED" }> {
  const [existing] = await db.select({ total: count() }).from(wishlists).where(eq(wishlists.ownerId, ownerId));
  if ((existing?.total ?? 0) >= MAX_WISHLISTS_PER_USER) return { ok: false, reason: "LIMIT_REACHED" };

  for (let attempt = 1; ; attempt++) {
    try {
      const [row] = await db
        .insert(wishlists)
        .values({ ownerId, title: input.title, occasion: input.occasion, eventDate: input.eventDate, slug: generateSlug() })
        .returning({ id: wishlists.id, title: wishlists.title, occasion: wishlists.occasion, eventDate: wishlists.eventDate, slug: wishlists.slug });
      return { ok: true, wishlist: { ...row!, itemCount: 0 } };
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= SLUG_ATTEMPTS) throw error;
    }
  }
}

export async function listWishlistsForOwner(db: Database, ownerId: string): Promise<WishlistSummary[]> {
  return summaryQuery(db).where(eq(wishlists.ownerId, ownerId)).orderBy(desc(wishlists.createdAt), desc(wishlists.id));
}

export async function getOwnedWishlist(db: Database, ownerId: string, wishlistId: string): Promise<WishlistSummary | null> {
  if (!isUuid(wishlistId)) return null;
  const [row] = await summaryQuery(db).where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)));
  return row ?? null;
}

export async function updateWishlist(db: Database, ownerId: string, wishlistId: string, input: WishlistInput): Promise<boolean> {
  if (!isUuid(wishlistId)) return false;
  const updated = await db
    .update(wishlists)
    .set({ title: input.title, occasion: input.occasion, eventDate: input.eventDate })
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)))
    .returning({ id: wishlists.id });
  return updated.length > 0;
}

export async function deleteWishlist(db: Database, ownerId: string, wishlistId: string): Promise<boolean> {
  if (!isUuid(wishlistId)) return false;
  const deleted = await db
    .delete(wishlists)
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)))
    .returning({ id: wishlists.id });
  return deleted.length > 0;
}
