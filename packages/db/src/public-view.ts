import { guestReservationView, isValidSlug, ownerReservationView, type Viewer } from "@wishlist/core";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { items, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";
import type { WishlistOccasion } from "./wishlists";

export type PublicItemStatus = "free" | "reserved_by_me" | "reserved_by_other";

export type PublicItemView = {
  id: string;
  title: string;
  sourceUrl: string | null;
  store: string | null;
  priceKopecks: number | null;
  currency: string;
  note: string | null;
  isMustHave: boolean;
  imageKey: string | null;
  status: PublicItemStatus;
};

export type PublicWishlistView = {
  wishlist: { id: string; title: string; occasion: WishlistOccasion; eventDate: string | null; slug: string };
  ownerName: string;
  isOwner: boolean;
  items: PublicItemView[];
};

const REDACTED_NAME = "";

export function firstName(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

export async function getPublicWishlist(db: Database, slug: string, viewer: Viewer): Promise<PublicWishlistView | null> {
  if (!isValidSlug(slug)) return null;
  const [header] = await db
    .select({
      id: wishlists.id,
      title: wishlists.title,
      occasion: wishlists.occasion,
      eventDate: wishlists.eventDate,
      slug: wishlists.slug,
      ownerId: wishlists.ownerId,
      ownerDisplayName: users.displayName,
      surpriseMode: users.surpriseMode,
    })
    .from(wishlists)
    .innerJoin(users, eq(users.id, wishlists.ownerId))
    .where(eq(wishlists.slug, slug));
  if (!header) return null;

  // guestUserId/guestToken нужны только для сравнения со зрителем и не попадают в результат
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
      reservationGuestUserId: reservations.guestUserId,
      reservationGuestToken: reservations.guestToken,
      reservationId: reservations.id,
    })
    .from(items)
    .leftJoin(reservations, and(eq(reservations.itemId, items.id), eq(reservations.status, "active")))
    // Гостям не показываем скелетоны: подарок без названия, который ещё парсится
    .where(and(eq(items.wishlistId, header.id), isNull(items.deletedAt), sql`not (${items.parseStatus} = 'pending' and ${items.title} = '')`))
    .orderBy(desc(items.isMustHave), desc(items.createdAt), desc(items.id));

  const isOwner = viewer.userId !== null && viewer.userId === header.ownerId;

  const publicItems = rows.map(({ reservationGuestUserId, reservationGuestToken, reservationId, ...item }) => {
    const state = {
      ownerId: header.ownerId,
      active: reservationId
        ? { guestUserId: reservationGuestUserId, guestToken: reservationGuestToken, guestName: REDACTED_NAME }
        : null,
    };
    const status: PublicItemStatus = isOwner
      ? ownerReservationView(state, header.surpriseMode).reserved ? "reserved_by_other" : "free"
      : guestReservationView(state, viewer).status;
    return { ...item, status };
  });

  return {
    wishlist: { id: header.id, title: header.title, occasion: header.occasion, eventDate: header.eventDate, slug: header.slug },
    ownerName: firstName(header.ownerDisplayName),
    isOwner,
    items: publicItems,
  };
}
