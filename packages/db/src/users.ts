import { and, eq } from "drizzle-orm";
import { authIdentities, type AuthProvider, users } from "./schema";
import type { Database } from "./types";

export type IdentityInput = { provider: AuthProvider; providerUserId: string; displayName: string; avatarUrl: string | null };
export type UserRecord = { id: string; displayName: string; avatarUrl: string | null; surpriseMode: boolean };
export type UserWithIdentities = UserRecord & { providers: AuthProvider[] };

const userColumns = { id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl, surpriseMode: users.surpriseMode };

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

export async function linkIdentity(
  db: Database,
  userId: string,
  input: IdentityInput,
): Promise<{ ok: true } | { ok: false; reason: "IDENTITY_TAKEN" | "PROVIDER_ALREADY_LINKED" }> {
  const owner = await findIdentityOwner(db, input.provider, input.providerUserId);
  if (owner === userId) return { ok: true };
  if (owner !== null) return { ok: false, reason: "IDENTITY_TAKEN" };
  const sameProvider = await db
    .select({ id: authIdentities.id })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, input.provider)))
    .limit(1);
  if (sameProvider.length > 0) return { ok: false, reason: "PROVIDER_ALREADY_LINKED" };
  await db.insert(authIdentities).values({ userId, provider: input.provider, providerUserId: input.providerUserId });
  return { ok: true };
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
