import { and, asc, count, eq, gte, isNull, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { firstName } from "./public-view";
import { authIdentities, items, notificationLog, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";
import type { WishlistOccasion } from "./wishlists";

export const DAILY_NOTIFICATION_LIMIT = 2;

export type NotificationKind = "owner_reserved" | "guest_reserved" | "item_deleted" | "reminder" | "owner_digest";

// Сводка броней собирает то, что дневной лимит не пропустил, поэтому сама лимит не занимает и не проверяет
const LIMIT_EXEMPT_KINDS: readonly NotificationKind[] = ["owner_digest"];
export type NotificationClaim = { userId: string; kind: NotificationKind; refId: string };

// Место в дневном лимите занимается до отправки; если Telegram не принял сообщение — releaseNotification
export async function claimNotification(db: Database, claim: NotificationClaim, day: string): Promise<boolean> {
  if (!LIMIT_EXEMPT_KINDS.includes(claim.kind)) {
    const [sent] = await db
      .select({ total: count() })
      .from(notificationLog)
      .where(and(eq(notificationLog.userId, claim.userId), eq(notificationLog.sentOn, day), sql`${notificationLog.kind} <> 'owner_digest'`));
    if ((sent?.total ?? 0) >= DAILY_NOTIFICATION_LIMIT) return false;
  }
  const inserted = await db
    .insert(notificationLog)
    .values({ userId: claim.userId, kind: claim.kind, refId: claim.refId, sentOn: day })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  return inserted.length > 0;
}

export async function releaseNotification(db: Database, claim: NotificationClaim): Promise<void> {
  await db
    .delete(notificationLog)
    .where(and(eq(notificationLog.userId, claim.userId), eq(notificationLog.kind, claim.kind), eq(notificationLog.refId, claim.refId)));
}

export async function getTelegramId(db: Database, userId: string): Promise<number | null> {
  const [row] = await db
    .select({ providerUserId: authIdentities.providerUserId })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "telegram")))
    .limit(1);
  return row ? Number(row.providerUserId) : null;
}

export type UnannouncedReservations = { ownerId: string; count: number };

// Брони, о которых владелец не узнал из-за дневного лимита (в «Полном сюрпризе» владельцу не пишем вовсе)
export async function listUnannouncedReservations(db: Database, since: Date): Promise<UnannouncedReservations[]> {
  return db
    .select({ ownerId: wishlists.ownerId, count: sql<number>`count(*)::int` })
    .from(reservations)
    .innerJoin(items, and(eq(items.id, reservations.itemId), isNull(items.deletedAt)))
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .innerJoin(users, and(eq(users.id, wishlists.ownerId), eq(users.surpriseMode, false)))
    .where(
      and(
        eq(reservations.status, "active"),
        gte(reservations.createdAt, since),
        sql`not exists (select 1 from ${notificationLog} where ${notificationLog.userId} = ${wishlists.ownerId} and ${notificationLog.kind} = 'owner_reserved' and ${notificationLog.refId} = ${reservations.id}::text)`,
      ),
    )
    .groupBy(wishlists.ownerId);
}

export type ReservationNotice = {
  reservationId: string;
  guestUserId: string | null;
  itemTitle: string;
  wishlistTitle: string;
  slug: string;
  occasion: WishlistOccasion;
  eventDate: string | null;
  ownerId: string;
  ownerName: string;
  surpriseMode: boolean;
};

// Удалённые подарки тоже ищутся: уведомление об удалении строится уже после мягкого удаления
export async function getActiveReservationNotice(db: Database, itemId: string): Promise<ReservationNotice | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({
      reservationId: reservations.id,
      guestUserId: reservations.guestUserId,
      itemTitle: items.title,
      wishlistTitle: wishlists.title,
      slug: wishlists.slug,
      occasion: wishlists.occasion,
      eventDate: wishlists.eventDate,
      ownerId: wishlists.ownerId,
      ownerDisplayName: users.displayName,
      surpriseMode: users.surpriseMode,
    })
    .from(reservations)
    .innerJoin(items, eq(items.id, reservations.itemId))
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .innerJoin(users, eq(users.id, wishlists.ownerId))
    .where(and(eq(reservations.itemId, itemId), eq(reservations.status, "active")));
  if (!row) return null;
  const { ownerDisplayName, ...notice } = row;
  return { ...notice, ownerName: firstName(ownerDisplayName) };
}

export type DueReminder = {
  guestUserId: string;
  itemTitle: string;
  wishlistTitle: string;
  slug: string;
  occasion: WishlistOccasion;
  ownerName: string;
  daysLeft: number;
};

export async function listDueReminders(db: Database, today: string, days: readonly number[]): Promise<DueReminder[]> {
  if (days.length === 0) return [];
  // date - date в Postgres — целое число дней
  const daysLeft = sql<number>`(${wishlists.eventDate} - ${today}::date)::int`;
  const rows = await db
    .select({
      guestUserId: reservations.guestUserId,
      itemTitle: items.title,
      wishlistTitle: wishlists.title,
      slug: wishlists.slug,
      occasion: wishlists.occasion,
      ownerDisplayName: users.displayName,
      daysLeft,
    })
    .from(reservations)
    .innerJoin(items, and(eq(items.id, reservations.itemId), isNull(items.deletedAt)))
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .innerJoin(users, eq(users.id, wishlists.ownerId))
    .innerJoin(authIdentities, and(eq(authIdentities.userId, reservations.guestUserId), eq(authIdentities.provider, "telegram")))
    .where(
      and(
        eq(reservations.status, "active"),
        sql`(${wishlists.eventDate} - ${today}::date) in (${sql.join(
          days.map((d) => sql`${d}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(asc(reservations.guestUserId), asc(wishlists.eventDate), asc(items.title));
  return rows.map(({ ownerDisplayName, guestUserId, ...rest }) => ({ ...rest, guestUserId: guestUserId!, ownerName: firstName(ownerDisplayName) }));
}
