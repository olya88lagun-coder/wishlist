import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isUuid } from "./errors";
import {
  SANTA_BUDGET_MAX,
  SANTA_MAX_GAMES_PER_ORGANIZER,
  SANTA_MAX_PARTICIPANTS,
  SANTA_MIN_PARTICIPANTS,
  SANTA_NAME_MAX,
  SANTA_TITLE_MAX,
} from "./limits";
import { authIdentities, items, santaGames, santaParticipants, users, wishlists } from "./schema";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

export type SantaGameStatus = "open" | "drawn";
export type SantaGameView = {
  game: { id: string; title: string; budgetText: string; exchangeDate: string; status: SantaGameStatus; joinCode: string | null };
  isOrganizer: boolean;
  me: { participantId: string; wishlistId: string | null; wishlistSlug: string | null };
  participants: { id: string; displayName: string; itemCount: number; signedIn: boolean }[];
  recipient: { displayName: string; wishlistSlug: string | null } | null;
};

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Random = (max: number) => number;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const newToken = () => randomBytes(32).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function cleanName(name: string): string | null {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= SANTA_NAME_MAX ? trimmed : null;
}

async function hasIdentity(db: Database | Tx, userId: string): Promise<boolean> {
  const [row] = await db.select({ id: authIdentities.id }).from(authIdentities).where(eq(authIdentities.userId, userId)).limit(1);
  return Boolean(row);
}

async function lockGame(tx: Tx, where: ReturnType<typeof eq>) {
  const [game] = await tx.select().from(santaGames).where(where).for("update");
  return game;
}

async function createSantaWishlist(tx: Tx, userId: string, title: string, exchangeDate: string): Promise<string | null> {
  const created = await createWishlist(tx as unknown as Database, userId, { title: `Тайный Санта: ${title}`, occasion: "new_year", eventDate: exchangeDate });
  return created.ok ? created.wishlist.id : null;
}

// Фишер — Йетс, затем каждый дарит следующему по кругу: себе никто не дарит, у каждого ровно один Санта
export function assignSantaRecipients(ids: readonly string[], random: Random = randomInt): Map<string, string> {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return new Map(order.map((id, i) => [id, order[(i + 1) % order.length]!]));
}

export async function createAnonymousUser(db: Database, displayName: string): Promise<{ userId: string }> {
  const [row] = await db.insert(users).values({ displayName, isAnonymous: true }).returning({ id: users.id });
  return { userId: row!.id };
}

export async function createSantaGame(
  db: Database,
  organizerId: string,
  input: { title: string; budgetText: string; exchangeDate: string; organizerName: string },
): Promise<{ ok: true; gameId: string; joinCode: string } | { ok: false; reason: "INVALID" | "LIMIT" | "ANONYMOUS_ORGANIZER" }> {
  const title = input.title.trim();
  const budgetText = input.budgetText.trim();
  const name = cleanName(input.organizerName);
  if (!title || title.length > SANTA_TITLE_MAX || budgetText.length > SANTA_BUDGET_MAX || !DATE_PATTERN.test(input.exchangeDate) || !name) {
    return { ok: false, reason: "INVALID" };
  }
  if (!(await hasIdentity(db, organizerId))) return { ok: false, reason: "ANONYMOUS_ORGANIZER" };
  const [existing] = await db.select({ total: count() }).from(santaGames).where(eq(santaGames.organizerId, organizerId));
  if ((existing?.total ?? 0) >= SANTA_MAX_GAMES_PER_ORGANIZER) return { ok: false, reason: "LIMIT" };

  return db.transaction(async (tx) => {
    const joinCode = newToken();
    const [game] = await tx.insert(santaGames).values({ organizerId, title, budgetText, exchangeDate: input.exchangeDate, joinCode }).returning({ id: santaGames.id });
    const wishlistId = await createSantaWishlist(tx, organizerId, title, input.exchangeDate);
    await tx.insert(santaParticipants).values({ gameId: game!.id, userId: organizerId, wishlistId, displayName: name });
    return { ok: true as const, gameId: game!.id, joinCode };
  });
}

export async function joinSantaGame(
  db: Database,
  joinCode: string,
  userId: string,
  displayName: string,
): Promise<
  | { ok: true; participantId: string; gameId: string; personalToken: string | null; alreadyJoined: boolean }
  | { ok: false; reason: "NOT_FOUND" | "CLOSED" | "FULL" | "INVALID_NAME" }
> {
  return db.transaction(async (tx) => {
    // Блокировка игры: жеребьёвка и вступление не могут пересечься
    const game = await lockGame(tx, eq(santaGames.joinCode, joinCode));
    if (!game) return { ok: false as const, reason: "NOT_FOUND" as const };
    const [existing] = await tx.select({ id: santaParticipants.id }).from(santaParticipants)
      .where(and(eq(santaParticipants.gameId, game.id), eq(santaParticipants.userId, userId)));
    if (existing) return { ok: true as const, participantId: existing.id, gameId: game.id, personalToken: null, alreadyJoined: true };
    const name = cleanName(displayName);
    if (!name) return { ok: false as const, reason: "INVALID_NAME" as const };
    if (game.status !== "open") return { ok: false as const, reason: "CLOSED" as const };
    const [participants] = await tx.select({ total: count() }).from(santaParticipants).where(eq(santaParticipants.gameId, game.id));
    if ((participants?.total ?? 0) >= SANTA_MAX_PARTICIPANTS) return { ok: false as const, reason: "FULL" as const };

    const [user] = await tx.select({ isAnonymous: users.isAnonymous }).from(users).where(eq(users.id, userId));
    const personalToken = user?.isAnonymous ? newToken() : null;
    const wishlistId = await createSantaWishlist(tx, userId, game.title, game.exchangeDate);
    const [row] = await tx.insert(santaParticipants).values({
      gameId: game.id, userId, wishlistId, displayName: name, personalTokenHash: personalToken ? hashToken(personalToken) : null,
    }).returning({ id: santaParticipants.id });
    return { ok: true as const, participantId: row!.id, gameId: game.id, personalToken, alreadyJoined: false };
  });
}

export async function drawSantaGame(
  db: Database,
  gameId: string,
  organizerId: string,
  random: Random = randomInt,
): Promise<{ ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_ORGANIZER" | "ALREADY_DRAWN" | "TOO_FEW" }> {
  if (!isUuid(gameId)) return { ok: false, reason: "NOT_FOUND" };
  return db.transaction(async (tx) => {
    const game = await lockGame(tx, eq(santaGames.id, gameId));
    if (!game) return { ok: false as const, reason: "NOT_FOUND" as const };
    if (game.organizerId !== organizerId) return { ok: false as const, reason: "NOT_ORGANIZER" as const };
    if (game.status !== "open") return { ok: false as const, reason: "ALREADY_DRAWN" as const };
    const order = await tx.select({ id: santaParticipants.id }).from(santaParticipants)
      .where(eq(santaParticipants.gameId, gameId)).orderBy(asc(santaParticipants.createdAt), asc(santaParticipants.id));
    if (order.length < SANTA_MIN_PARTICIPANTS) return { ok: false as const, reason: "TOO_FEW" as const };

    for (const [giver, recipient] of assignSantaRecipients(order.map((p) => p.id), random)) {
      await tx.update(santaParticipants)
        .set({ recipientParticipantId: recipient, recoveryTokenHash: null })
        .where(eq(santaParticipants.id, giver));
    }
    await tx.update(santaGames).set({ status: "drawn", drawnAt: new Date() }).where(eq(santaGames.id, gameId));
    return { ok: true as const };
  });
}

export async function removeSantaParticipant(db: Database, gameId: string, organizerId: string, participantId: string): Promise<boolean> {
  if (!isUuid(gameId) || !isUuid(participantId)) return false;
  return db.transaction(async (tx) => {
    const game = await lockGame(tx, eq(santaGames.id, gameId));
    if (!game || game.organizerId !== organizerId || game.status !== "open") return false;
    const deleted = await tx.delete(santaParticipants)
      .where(and(eq(santaParticipants.id, participantId), eq(santaParticipants.gameId, gameId), sql`${santaParticipants.userId} <> ${organizerId}`))
      .returning({ id: santaParticipants.id });
    return deleted.length > 0;
  });
}

export async function issueRecoveryToken(db: Database, gameId: string, organizerId: string, participantId: string): Promise<string | null> {
  if (!isUuid(gameId) || !isUuid(participantId)) return null;
  return db.transaction(async (tx) => {
    const game = await lockGame(tx, eq(santaGames.id, gameId));
    if (!game || game.organizerId !== organizerId || game.status !== "open") return null;
    const [participant] = await tx.select({ userId: santaParticipants.userId, isAnonymous: users.isAnonymous })
      .from(santaParticipants).innerJoin(users, eq(users.id, santaParticipants.userId))
      .where(and(eq(santaParticipants.id, participantId), eq(santaParticipants.gameId, gameId)));
    if (!participant?.isAnonymous || (await hasIdentity(tx, participant.userId))) return null;
    const token = newToken();
    await tx.update(santaParticipants).set({ recoveryTokenHash: hashToken(token) }).where(eq(santaParticipants.id, participantId));
    return token;
  });
}

// Личная ссылка или одноразовая ссылка для возврата. Обе не работают для пользователя с привязанным входом
export async function redeemSantaToken(db: Database, token: string): Promise<{ userId: string; gameId: string } | null> {
  const hash = hashToken(token);
  return db.transaction(async (tx) => {
    const [participant] = await tx.select().from(santaParticipants)
      .where(or(eq(santaParticipants.personalTokenHash, hash), eq(santaParticipants.recoveryTokenHash, hash)));
    if (!participant || (await hasIdentity(tx, participant.userId))) return null;
    if (participant.recoveryTokenHash === hash) {
      await tx.update(santaParticipants).set({ recoveryTokenHash: null }).where(eq(santaParticipants.id, participant.id));
    }
    return { userId: participant.userId, gameId: participant.gameId };
  });
}

export async function getSantaGameView(db: Database, gameId: string, userId: string): Promise<SantaGameView | null> {
  if (!isUuid(gameId)) return null;
  const [me] = await db.select().from(santaParticipants).where(and(eq(santaParticipants.gameId, gameId), eq(santaParticipants.userId, userId)));
  if (!me) return null;
  const [game] = await db.select().from(santaGames).where(eq(santaGames.id, gameId));
  if (!game) return null;
  const isOrganizer = game.organizerId === userId;

  const rows = await db
    .select({
      id: santaParticipants.id,
      userId: santaParticipants.userId,
      displayName: santaParticipants.displayName,
      wishlistId: santaParticipants.wishlistId,
      slug: wishlists.slug,
      itemCount: sql<number>`count(${items.id})::int`,
    })
    .from(santaParticipants)
    .leftJoin(wishlists, eq(wishlists.id, santaParticipants.wishlistId))
    .leftJoin(items, and(eq(items.wishlistId, wishlists.id), isNull(items.deletedAt)))
    .where(eq(santaParticipants.gameId, gameId))
    .groupBy(santaParticipants.id, wishlists.slug)
    .orderBy(asc(santaParticipants.createdAt), asc(santaParticipants.id));
  const identified = rows.length === 0 ? [] : await db.selectDistinct({ userId: authIdentities.userId }).from(authIdentities)
    .where(inArray(authIdentities.userId, rows.map((r) => r.userId)));
  const signedIn = new Set(identified.map((r) => r.userId));
  const mine = rows.find((r) => r.id === me.id)!;
  const recipient = me.recipientParticipantId ? rows.find((r) => r.id === me.recipientParticipantId) : undefined;

  return {
    game: { id: game.id, title: game.title, budgetText: game.budgetText, exchangeDate: game.exchangeDate, status: game.status, joinCode: isOrganizer ? game.joinCode : null },
    isOrganizer,
    me: { participantId: me.id, wishlistId: me.wishlistId, wishlistSlug: mine.slug },
    participants: rows.map((r) => ({ id: r.id, displayName: r.displayName, itemCount: r.itemCount, signedIn: signedIn.has(r.userId) })),
    recipient: recipient ? { displayName: recipient.displayName, wishlistSlug: recipient.slug } : null,
  };
}

export async function listSantaGamesForUser(db: Database, userId: string): Promise<{ id: string; title: string; status: SantaGameStatus }[]> {
  return db.select({ id: santaGames.id, title: santaGames.title, status: santaGames.status })
    .from(santaParticipants).innerJoin(santaGames, eq(santaGames.id, santaParticipants.gameId))
    .where(eq(santaParticipants.userId, userId)).orderBy(asc(santaGames.createdAt));
}

export async function getSantaJoinInfo(db: Database, joinCode: string): Promise<{
  gameId: string; title: string; budgetText: string; exchangeDate: string; status: SantaGameStatus; participantCount: number;
} | null> {
  const [row] = await db
    .select({
      gameId: santaGames.id, title: santaGames.title, budgetText: santaGames.budgetText, exchangeDate: santaGames.exchangeDate,
      status: santaGames.status, participantCount: sql<number>`count(${santaParticipants.id})::int`,
    })
    .from(santaGames).leftJoin(santaParticipants, eq(santaParticipants.gameId, santaGames.id))
    .where(eq(santaGames.joinCode, joinCode)).groupBy(santaGames.id);
  return row ?? null;
}

// Анонимный профиль, созданный под неудачное вступление, не должен оставаться в базе
export async function discardAnonymousUser(db: Database, userId: string): Promise<void> {
  const [participant] = await db.select({ id: santaParticipants.id }).from(santaParticipants).where(eq(santaParticipants.userId, userId)).limit(1);
  if (participant) return;
  await db.delete(users).where(and(eq(users.id, userId), eq(users.isAnonymous, true)));
}

export type SantaNotice = { userId: string; gameId: string; gameTitle: string; exchangeDate: string; recipientName: string };

const recipients = alias(santaParticipants, "recipient");
const noticeColumns = {
  userId: santaParticipants.userId, gameId: santaGames.id, gameTitle: santaGames.title,
  exchangeDate: santaGames.exchangeDate, recipientName: recipients.displayName,
};

// Кому и кого дарить — только для уведомлений воркера, каждому участнику свой получатель
export async function listSantaNotices(db: Database, gameId: string): Promise<SantaNotice[]> {
  if (!isUuid(gameId)) return [];
  return db.select(noticeColumns).from(santaParticipants)
    .innerJoin(santaGames, eq(santaGames.id, santaParticipants.gameId))
    .innerJoin(recipients, eq(recipients.id, santaParticipants.recipientParticipantId))
    .where(and(eq(santaParticipants.gameId, gameId), eq(santaGames.status, "drawn")));
}

export async function listDueSantaReminders(db: Database, today: string, daysBefore: number): Promise<SantaNotice[]> {
  return db.select(noticeColumns).from(santaParticipants)
    .innerJoin(santaGames, eq(santaGames.id, santaParticipants.gameId))
    .innerJoin(recipients, eq(recipients.id, santaParticipants.recipientParticipantId))
    .where(and(eq(santaGames.status, "drawn"), sql`(${santaGames.exchangeDate} - ${today}::date) = ${daysBefore}`));
}

export const SANTA_RETENTION_DAYS = 60;

// Анонимный профиль удаляется, когда все его игры старше срока хранения; профиль с входом остаётся
export async function deleteExpiredSantaData(db: Database, today: string): Promise<{ users: number; games: number }> {
  const expired = sql`(${santaGames.exchangeDate} + ${SANTA_RETENTION_DAYS}::int) < ${today}::date`;
  return db.transaction(async (tx) => {
    const deletedUsers = await tx.delete(users).where(and(
      eq(users.isAnonymous, true),
      sql`not exists (select 1 from ${authIdentities} where ${authIdentities.userId} = ${users.id})`,
      sql`exists (select 1 from ${santaParticipants} where ${santaParticipants.userId} = ${users.id})`,
      sql`not exists (select 1 from ${santaParticipants} join ${santaGames} on ${santaGames.id} = ${santaParticipants.gameId}
        where ${santaParticipants.userId} = ${users.id} and not ${expired})`,
    )).returning({ id: users.id });
    // Анонимный участник, которого организатор удалил из игры: игр нет, отсчитываем срок от создания профиля
    const orphans = await tx.delete(users).where(and(
      eq(users.isAnonymous, true),
      sql`not exists (select 1 from ${authIdentities} where ${authIdentities.userId} = ${users.id})`,
      sql`not exists (select 1 from ${santaParticipants} where ${santaParticipants.userId} = ${users.id})`,
      sql`(${users.createdAt}::date + ${SANTA_RETENTION_DAYS}::int) < ${today}::date`,
    )).returning({ id: users.id });
    const deletedGames = await tx.delete(santaGames).where(expired).returning({ id: santaGames.id });
    return { users: deletedUsers.length + orphans.length, games: deletedGames.length };
  });
}
