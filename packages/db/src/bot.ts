import { and, eq, isNull } from "drizzle-orm";
import { isUuid } from "./errors";
import { ownedItemId } from "./items";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { authIdentities, type ItemParseStatus, items, reservations, wishlists } from "./schema";
import type { Database } from "./types";
import { getOwnedWishlist } from "./wishlists";

export async function findUserIdByTelegram(db: Database, telegramId: number): Promise<string | null> {
  const [row] = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, "telegram"), eq(authIdentities.providerUserId, String(telegramId))))
    .limit(1);
  return row?.userId ?? null;
}

export type AttachResult = "attached" | "already_yours" | "taken" | "not_found";

// Гость с сайта нажал «Напомнить в Telegram»: бронь получает пользователя, и напоминания начинают ходить
export async function attachReservationToUser(db: Database, reservationId: string, userId: string): Promise<AttachResult> {
  if (!isUuid(reservationId)) return "not_found";
  const [row] = await db
    .select({ guestUserId: reservations.guestUserId })
    .from(reservations)
    .where(and(eq(reservations.id, reservationId), eq(reservations.status, "active")));
  if (!row) return "not_found";
  if (row.guestUserId === userId) return "already_yours";
  if (row.guestUserId !== null) return "taken";
  const updated = await db
    .update(reservations)
    .set({ guestUserId: userId })
    .where(and(eq(reservations.id, reservationId), isNull(reservations.guestUserId)))
    .returning({ id: reservations.id });
  return updated.length > 0 ? "attached" : "taken";
}

export async function cancelReservationForUser(db: Database, reservationId: string, userId: string): Promise<boolean> {
  if (!isUuid(reservationId)) return false;
  const cancelled = await db
    .update(reservations)
    .set({ status: "cancelled" })
    .where(and(eq(reservations.id, reservationId), eq(reservations.guestUserId, userId), eq(reservations.status, "active")))
    .returning({ id: reservations.id });
  return cancelled.length > 0;
}

export type BotItemCard = {
  id: string;
  ownerId: string;
  wishlistId: string;
  wishlistTitle: string;
  title: string;
  sourceUrl: string | null;
  priceKopecks: number | null;
  imageKey: string | null;
  parseStatus: ItemParseStatus;
  deleted: boolean;
};

export async function getBotItemCard(db: Database, itemId: string): Promise<BotItemCard | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({
      id: items.id,
      ownerId: wishlists.ownerId,
      wishlistId: wishlists.id,
      wishlistTitle: wishlists.title,
      title: items.title,
      sourceUrl: items.sourceUrl,
      priceKopecks: items.priceKopecks,
      imageKey: items.imageKey,
      parseStatus: items.parseStatus,
      deletedAt: items.deletedAt,
    })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(eq(items.id, itemId));
  if (!row) return null;
  const { deletedAt, ...card } = row;
  return { ...card, deleted: deletedAt !== null };
}

export type MoveResult = "moved" | "not_found" | "limit_reached";

export async function moveItem(db: Database, ownerId: string, itemId: string, toWishlistId: string): Promise<MoveResult> {
  const id = await ownedItemId(db, ownerId, itemId);
  const target = await getOwnedWishlist(db, ownerId, toWishlistId);
  if (!id || !target) return "not_found";
  const [current] = await db.select({ wishlistId: items.wishlistId }).from(items).where(eq(items.id, id));
  if (current?.wishlistId === target.id) return "moved";
  if (target.itemCount >= MAX_ITEMS_PER_WISHLIST) return "limit_reached";
  await db.update(items).set({ wishlistId: target.id }).where(eq(items.id, id));
  return "moved";
}
