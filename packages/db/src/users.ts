import { and, eq, sql } from "drizzle-orm";
import { authIdentities, type AuthProvider, reservations, users, wishlistDeletionNotices, wishlists } from "./schema";
import type { Database } from "./types";

export type IdentityInput = { provider: AuthProvider; providerUserId: string; displayName: string; avatarUrl: string | null };
export type UserRecord = { id: string; displayName: string; avatarUrl: string | null; surpriseMode: boolean; isAnonymous: boolean; sessionVersion: number };
export type UserWithIdentities = UserRecord & { providers: AuthProvider[] };

const userColumns = {
  id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, surpriseMode: users.surpriseMode,
  isAnonymous: users.isAnonymous, sessionVersion: users.sessionVersion,
};

async function findIdentityOwner(db: Database, provider: AuthProvider, providerUserId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, providerUserId)))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export async function upsertUserFromIdentity(db: Database, input: IdentityInput): Promise<UserRecord> {
  const existingUserId = await findIdentityOwner(db, input.provider, input.providerUserId);
  if (existingUserId) {
    // Drizzle не допускает пустой update, поэтому без нового аватара пользователь просто читается
    if (input.avatarUrl === null) {
      const [existing] = await db.select(userColumns).from(users).where(eq(users.id, existingUserId)).limit(1);
      return existing!;
    }
    const [updated] = await db
      .update(users)
      .set({ avatarUrl: input.avatarUrl })
      .where(eq(users.id, existingUserId))
      .returning(userColumns);
    return updated!;
  }
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ displayName: input.displayName, avatarUrl: input.avatarUrl })
      .returning(userColumns);
    await tx.insert(authIdentities).values({ userId: created!.id, provider: input.provider, providerUserId: input.providerUserId });
    return created!;
  });
}

export async function isProfileEmpty(db: Database, userId: string): Promise<boolean> {
  const [list] = await db.select({ id: wishlists.id }).from(wishlists).where(eq(wishlists.ownerId, userId)).limit(1);
  if (list) return false;
  const [reservation] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.guestUserId, userId)).limit(1);
  return !reservation;
}

// Анонимный участник Санты получил вход: личные ссылки и выданные по ним cookie больше не действуют
async function leaveAnonymity(db: Database, userId: string): Promise<void> {
  const [anonymous] = await db.update(users).set({ isAnonymous: false })
    .where(and(eq(users.id, userId), eq(users.isAnonymous, true))).returning({ id: users.id });
  if (anonymous) await bumpSessionVersion(db, userId);
}

export async function linkIdentity(
  db: Database,
  userId: string,
  input: IdentityInput,
): Promise<{ ok: true } | { ok: false; reason: "IDENTITY_TAKEN" | "PROVIDER_ALREADY_LINKED" }> {
  const owner = await findIdentityOwner(db, input.provider, input.providerUserId);
  if (owner === userId) return { ok: true };

  const sameProvider = await db
    .select({ id: authIdentities.id })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, input.provider)))
    .limit(1);
  if (sameProvider.length > 0) return { ok: false, reason: "PROVIDER_ALREADY_LINKED" };

  if (owner === null) {
    await db.insert(authIdentities).values({ userId, provider: input.provider, providerUserId: input.providerUserId });
    await leaveAnonymity(db, userId);
    return { ok: true };
  }

  if (!(await isProfileEmpty(db, owner))) return { ok: false, reason: "IDENTITY_TAKEN" };

  // Пустой профиль остался от входа другим способом: переносим аккаунт и удаляем профиль-пустышку
  await db.transaction(async (tx) => {
    await tx
      .update(authIdentities)
      .set({ userId })
      .where(and(eq(authIdentities.provider, input.provider), eq(authIdentities.providerUserId, input.providerUserId)));
    // У удалённого списка уже нет броней, но сообщение дарителю ещё может ожидать отправки.
    const notices = await tx.select().from(wishlistDeletionNotices).where(eq(wishlistDeletionNotices.guestUserId, owner)).for("update");
    for (const notice of notices) {
      const [duplicate] = await tx.select({ id: wishlistDeletionNotices.id }).from(wishlistDeletionNotices)
        .where(and(eq(wishlistDeletionNotices.guestUserId, userId), eq(wishlistDeletionNotices.wishlistId, notice.wishlistId))).limit(1);
      if (!duplicate) await tx.update(wishlistDeletionNotices).set({ guestUserId: userId }).where(eq(wishlistDeletionNotices.id, notice.id));
    }
    await tx.delete(users).where(eq(users.id, owner));
  });
  await leaveAnonymity(db, userId);
  return { ok: true };
}

export async function setSurpriseMode(db: Database, userId: string, enabled: boolean): Promise<void> {
  await db.update(users).set({ surpriseMode: enabled }).where(eq(users.id, userId));
}

export async function getUserWithIdentities(db: Database, userId: string): Promise<UserWithIdentities | null> {
  const [user] = await db.select(userColumns).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const identities = await db
    .select({ provider: authIdentities.provider })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId));
  return { ...user, providers: identities.map((i) => i.provider) };
}

// Отзывает все выданные сессии пользователя: getCurrentUser сверяет версию из cookie с этой
export async function bumpSessionVersion(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  return row!.sessionVersion;
}
