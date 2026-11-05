import { and, eq, inArray } from "drizzle-orm";
import {
  designPurchases,
  featureInterest,
  notificationLog,
  reservations,
  santaGames,
  santaParticipants,
  users,
  wishlistDeletionNotices,
  wishlists,
} from "./schema";
import type { Database } from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Участник игры дважды (анонимно и своим аккаунтом): анонимную запись убираем.
// После жеребьёвки её Санта получает её получателя, чтобы круг не разорвался.
async function dropDuplicateParticipants(tx: Tx, anonymousUserId: string, targetUserId: string) {
  const anonRows = await tx.select().from(santaParticipants).where(eq(santaParticipants.userId, anonymousUserId));
  for (const anon of anonRows) {
    const [twin] = await tx.select({ id: santaParticipants.id }).from(santaParticipants)
      .where(and(eq(santaParticipants.gameId, anon.gameId), eq(santaParticipants.userId, targetUserId)));
    if (!twin) continue;
    if (anon.recipientParticipantId) {
      await tx.update(santaParticipants).set({ recipientParticipantId: anon.recipientParticipantId })
        .where(eq(santaParticipants.recipientParticipantId, anon.id));
    }
    await tx.delete(santaParticipants).where(eq(santaParticipants.id, anon.id));
  }
}

// Строки с уникальным индексом по пользователю: переносим только те, которых у целевого ещё нет
async function moveUnique<T extends { id: unknown }>(rows: T[], exists: (row: T) => Promise<boolean>, move: (row: T) => Promise<unknown>, drop: (row: T) => Promise<unknown>) {
  for (const row of rows) await ((await exists(row)) ? drop(row) : move(row));
}

export async function mergeAnonymousUser(db: Database, anonymousUserId: string, targetUserId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await dropDuplicateParticipants(tx, anonymousUserId, targetUserId);
    await tx.update(santaParticipants).set({ userId: targetUserId }).where(eq(santaParticipants.userId, anonymousUserId));
    await tx.update(santaGames).set({ organizerId: targetUserId }).where(eq(santaGames.organizerId, anonymousUserId));
    await tx.update(wishlists).set({ ownerId: targetUserId }).where(eq(wishlists.ownerId, anonymousUserId));
    await tx.update(reservations).set({ guestUserId: targetUserId }).where(eq(reservations.guestUserId, anonymousUserId));
    await tx.update(designPurchases).set({ userId: targetUserId }).where(eq(designPurchases.userId, anonymousUserId));

    const notices = await tx.select({ id: wishlistDeletionNotices.id, wishlistId: wishlistDeletionNotices.wishlistId })
      .from(wishlistDeletionNotices).where(eq(wishlistDeletionNotices.guestUserId, anonymousUserId)).for("update");
    await moveUnique(
      notices,
      async (n) => (await tx.select({ id: wishlistDeletionNotices.id }).from(wishlistDeletionNotices)
        .where(and(eq(wishlistDeletionNotices.guestUserId, targetUserId), eq(wishlistDeletionNotices.wishlistId, n.wishlistId)))).length > 0,
      (n) => tx.update(wishlistDeletionNotices).set({ guestUserId: targetUserId }).where(eq(wishlistDeletionNotices.id, n.id)),
      (n) => tx.delete(wishlistDeletionNotices).where(eq(wishlistDeletionNotices.id, n.id)),
    );

    const logs = await tx.select({ id: notificationLog.id, kind: notificationLog.kind, refId: notificationLog.refId })
      .from(notificationLog).where(eq(notificationLog.userId, anonymousUserId));
    await moveUnique(
      logs,
      async (l) => (await tx.select({ id: notificationLog.id }).from(notificationLog)
        .where(and(eq(notificationLog.userId, targetUserId), eq(notificationLog.kind, l.kind), eq(notificationLog.refId, l.refId)))).length > 0,
      (l) => tx.update(notificationLog).set({ userId: targetUserId }).where(eq(notificationLog.id, l.id)),
      (l) => tx.delete(notificationLog).where(eq(notificationLog.id, l.id)),
    );

    const interest = await tx.select({ feature: featureInterest.feature }).from(featureInterest).where(eq(featureInterest.userId, anonymousUserId));
    const known = new Set((await tx.select({ feature: featureInterest.feature }).from(featureInterest)
      .where(and(eq(featureInterest.userId, targetUserId), inArray(featureInterest.feature, interest.map((i) => i.feature).concat(""))))).map((i) => i.feature));
    for (const { feature } of interest) {
      if (!known.has(feature)) await tx.insert(featureInterest).values({ userId: targetUserId, feature });
    }

    // Каскад удалит оставшиеся строки анонимного профиля (дубли интереса и т. п.)
    await tx.delete(users).where(eq(users.id, anonymousUserId));
  });
}
