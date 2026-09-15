import { detectStore, ownerReservationView } from "@wishlist/core";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { items, type ItemParseStatus, users, wishlists } from "./schema";
import type { Database } from "./types";
import { getOwnedWishlist, type WishlistSummary } from "./wishlists";

export type ItemInput = { title: string; sourceUrl: string | null; priceKopecks: number | null; note: string | null; isMustHave: boolean };

export type OwnerItemView = {
  id: string;
  title: string;
  sourceUrl: string | null;
  store: string | null;
  priceKopecks: number | null;
  currency: string;
  note: string | null;
  isMustHave: boolean;
  reserved: boolean;
  imageKey: string | null;
  parseStatus: ItemParseStatus;
};

export type OwnerWishlistView = { wishlist: WishlistSummary; surpriseMode: boolean; items: OwnerItemView[] };

// Владельцу нужна только сама наличность брони; данные гостя сюда не выбираются вовсе
const REDACTED_RESERVATION = { guestUserId: null, guestToken: null, guestName: "" };

function itemValues(input: ItemInput) {
  return {
    title: input.title,
    sourceUrl: input.sourceUrl,
    normalizedUrl: input.sourceUrl,
    store: input.sourceUrl ? detectStore(input.sourceUrl).id : null,
    priceKopecks: input.priceKopecks,
    note: input.note,
    isMustHave: input.isMustHave,
  };
}

export async function ownedItemId(db: Database, ownerId: string, itemId: string): Promise<string | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({ id: items.id })
    .from(items)
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .where(and(eq(items.id, itemId), eq(wishlists.ownerId, ownerId), isNull(items.deletedAt)));
  return row?.id ?? null;
}

export async function addItem(
  db: Database,
  ownerId: string,
  wishlistId: string,
  input: ItemInput,
): Promise<{ ok: true; itemId: string; needsParsing: boolean } | { ok: false; reason: "NOT_FOUND" | "LIMIT_REACHED" }> {
  const wishlist = await getOwnedWishlist(db, ownerId, wishlistId);
  if (!wishlist) return { ok: false, reason: "NOT_FOUND" };
  const [existing] = await db
    .select({ total: count() })
    .from(items)
    .where(and(eq(items.wishlistId, wishlistId), isNull(items.deletedAt)));
  if ((existing?.total ?? 0) >= MAX_ITEMS_PER_WISHLIST) return { ok: false, reason: "LIMIT_REACHED" };
  const needsParsing = input.sourceUrl !== null;
  const [row] = await db
    .insert(items)
    .values({ wishlistId, parseStatus: needsParsing ? "pending" : "ok", ...itemValues(input) })
    .returning({ id: items.id });
  return { ok: true, itemId: row!.id, needsParsing };
}

export async function updateItem(
  db: Database,
  ownerId: string,
  itemId: string,
  input: ItemInput,
): Promise<{ ok: true; needsParsing: boolean } | { ok: false }> {
  const id = await ownedItemId(db, ownerId, itemId);
  if (!id) return { ok: false };
  const [current] = await db.select({ sourceUrl: items.sourceUrl }).from(items).where(eq(items.id, id));
  const linkChanged = (current?.sourceUrl ?? null) !== input.sourceUrl;
  const needsParsing = linkChanged && input.sourceUrl !== null;
  // Фото и описание принадлежат старому товару; без ссылки фото из магазина тоже не нужно
  const reset = linkChanged ? { imageKey: null, description: null } : {};
  await db
    .update(items)
    .set({ ...itemValues(input), ...reset, parseStatus: needsParsing ? "pending" : "ok" })
    .where(eq(items.id, id));
  return { ok: true, needsParsing };
}

export async function deleteItem(db: Database, ownerId: string, itemId: string): Promise<boolean> {
  const id = await ownedItemId(db, ownerId, itemId);
  if (!id) return false;
  await db.update(items).set({ deletedAt: new Date() }).where(eq(items.id, id));
  return true;
}

export async function getOwnerWishlistView(db: Database, ownerId: string, wishlistId: string): Promise<OwnerWishlistView | null> {
  const wishlist = await getOwnedWishlist(db, ownerId, wishlistId);
  if (!wishlist) return null;
  const [owner] = await db.select({ surpriseMode: users.surpriseMode }).from(users).where(eq(users.id, ownerId));
  const surpriseMode = owner?.surpriseMode ?? false;

  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      sourceUrl: items.sourceUrl,
      store: items.store,
      priceKopecks: items.priceKopecks,
      currency: items.currency,
      note: items.note,
      isMustHave: items.isMustHave,
      imageKey: items.imageKey,
      parseStatus: items.parseStatus,
      // Имена таблиц пишем явно: в select с одной таблицей Drizzle не квалифицирует колонки,
      // и "id" внутри подзапроса молча резолвился бы в reservations.id
      hasActiveReservation: sql<boolean>`exists (select 1 from "reservations" r where r."item_id" = "items"."id" and r."status" = 'active')`,
    })
    .from(items)
    .where(and(eq(items.wishlistId, wishlistId), isNull(items.deletedAt)))
    .orderBy(desc(items.isMustHave), desc(items.createdAt), desc(items.id));

  return {
    wishlist,
    surpriseMode,
    items: rows.map(({ hasActiveReservation, ...item }) => ({
      ...item,
      reserved: ownerReservationView(
        { ownerId, active: hasActiveReservation ? REDACTED_RESERVATION : null },
        surpriseMode,
      ).reserved,
    })),
  };
}
