import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "./types";
import { authIdentities, wishlistDeletionNotices as notices } from "./schema";

export type WishlistDeletionNotice = typeof notices.$inferSelect;
const LEASE_MS = 5 * 60_000;

export async function claimWishlistDeletionNotice(db: Database, now: Date): Promise<WishlistDeletionNotice | null> {
  return db.transaction(async (tx) => {
    const [pending] = await tx.select({ id: notices.id }).from(notices)
      .where(and(isNull(notices.completedAt), lte(notices.availableAt, now), or(isNull(notices.leaseUntil), lte(notices.leaseUntil, now))))
      .orderBy(asc(notices.createdAt), asc(notices.id)).limit(1).for("update", { skipLocked: true });
    if (!pending) return null;
    const [leased] = await tx.update(notices).set({
      leaseToken: randomUUID(), leaseUntil: new Date(now.getTime() + LEASE_MS), attempts: sql`${notices.attempts} + 1`,
    }).where(eq(notices.id, pending.id)).returning();
    return leased ?? null;
  });
}

function currentLease(notice: WishlistDeletionNotice) {
  return and(eq(notices.id, notice.id), eq(notices.leaseToken, notice.leaseToken!), isNull(notices.completedAt));
}

// Получатель мог сменить профиль при привязке аккаунта после захвата сообщения.
export async function getWishlistDeletionTelegramId(db: Database, notice: WishlistDeletionNotice): Promise<number | null> {
  if (!notice.leaseToken) return null;
  const [identity] = await db.select({ providerUserId: authIdentities.providerUserId }).from(notices)
    .innerJoin(authIdentities, and(eq(authIdentities.userId, notices.guestUserId), eq(authIdentities.provider, "telegram")))
    .where(currentLease(notice)).limit(1);
  return identity ? Number(identity.providerUserId) : null;
}

export async function finishWishlistDeletionNotice(db: Database, notice: WishlistDeletionNotice, now: Date, outcome: "sent" | "rejected" | "no_telegram"): Promise<boolean> {
  if (!notice.leaseToken) return false;
  const updated = await db.update(notices).set({
    completedAt: now, outcome, wishlistTitle: "", leaseToken: null, leaseUntil: null,
  }).where(currentLease(notice)).returning({ id: notices.id });
  return updated.length > 0;
}

export async function retryWishlistDeletionNotice(db: Database, notice: WishlistDeletionNotice, now: Date): Promise<boolean> {
  if (!notice.leaseToken) return false;
  const delay = Math.min(60 * 2 ** Math.min(10, Math.max(0, notice.attempts - 1)), 3600) * 1000;
  const updated = await db.update(notices).set({
    availableAt: new Date(now.getTime() + delay), leaseToken: null, leaseUntil: null,
  }).where(currentLease(notice)).returning({ id: notices.id });
  return updated.length > 0;
}
