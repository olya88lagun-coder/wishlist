import { generateSlug } from "@wishlist/core";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { isUniqueViolation, isUuid } from "./errors";
import { MAX_WISHLISTS_PER_USER } from "./limits";
import { audienceEnum, authIdentities, items, occasionEnum, reservations, wishlistDeletionNotices, wishlists } from "./schema";
import type { Database } from "./types";

export type WishlistOccasion = (typeof occasionEnum.enumValues)[number];
export type WishlistAudience = (typeof audienceEnum.enumValues)[number];
// audience: undefined — не менять, null — «не указано»
export type WishlistInput = { title: string; occasion: WishlistOccasion; eventDate: string | null; audience?: WishlistAudience | null };
export type WishlistSummary = {
  id: string;
  title: string;
  occasion: WishlistOccasion;
  audience: WishlistAudience | null;
  eventDate: string | null;
  slug: string;
  itemCount: number;
};

const SLUG_ATTEMPTS = 3;

const summaryColumns = {
  id: wishlists.id,
  title: wishlists.title,
  occasion: wishlists.occasion,
  audience: wishlists.audience,
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
        .values({ ownerId, title: input.title, occasion: input.occasion, audience: input.audience ?? null, eventDate: input.eventDate, slug: generateSlug() })
        .returning({ id: wishlists.id, title: wishlists.title, occasion: wishlists.occasion, audience: wishlists.audience, eventDate: wishlists.eventDate, slug: wishlists.slug });
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
    .set({ title: input.title, occasion: input.occasion, eventDate: input.eventDate, ...(input.audience === undefined ? {} : { audience: input.audience }) })
    .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId)))
    .returning({ id: wishlists.id });
  return updated.length > 0;
}

export async function deleteWishlist(db: Database, ownerId: string, wishlistId: string): Promise<boolean> {
  if (!isUuid(wishlistId)) return false;
  return db.transaction(async (tx) => {
    const [list] = await tx.select({ id: wishlists.id, title: wishlists.title }).from(wishlists)
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.ownerId, ownerId))).for("update");
    if (!list) return false;
    // FK-проверка новой брони блокируется на подарке: успешная бронь не проскочит между снимком и удалением.
    await tx.select({ id: items.id }).from(items).where(eq(items.wishlistId, list.id)).for("update");
    const recipients = await tx.selectDistinct({ guestUserId: authIdentities.userId }).from(reservations)
      .innerJoin(items, eq(items.id, reservations.itemId))
      .innerJoin(authIdentities, and(eq(authIdentities.userId, reservations.guestUserId), eq(authIdentities.provider, "telegram")))
      .where(and(eq(items.wishlistId, list.id), isNull(items.deletedAt), eq(reservations.status, "active")));
    if (recipients.length) {
      await tx.insert(wishlistDeletionNotices).values(recipients.map(({ guestUserId }) => ({
        wishlistId: list.id, guestUserId, wishlistTitle: list.title,
      }))).onConflictDoNothing();
    }
    await tx.delete(wishlists).where(eq(wishlists.id, list.id));
    return true;
  });
}
