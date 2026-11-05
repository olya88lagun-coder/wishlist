import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { mergeAnonymousUser } from "./anonymous-merge";
import { addItem } from "./items";
import { reserveItem } from "./reservations";
import { createAnonymousUser, createSantaGame, drawSantaGame, getSantaGameView, joinSantaGame } from "./santa";
import { authIdentities, designPurchases, featureInterest, reservations, santaParticipants, users, wishlists } from "./schema";
import { createTestDb } from "./testing";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

let db: Database;
let target: string;
let organizer: string;
let joinCode: string;
let gameId: string;

async function identified(name: string, id: string) {
  const { userId } = await createAnonymousUser(db, name);
  await db.update(users).set({ isAnonymous: false }).where(eq(users.id, userId));
  await db.insert(authIdentities).values({ userId, provider: "telegram", providerUserId: id });
  return userId;
}

beforeEach(async () => {
  db = await createTestDb();
  organizer = await identified("Оля", "1");
  target = await identified("Петя", "2");
  await db.update(users).set({ surpriseMode: true }).where(eq(users.id, target));
  const game = await createSantaGame(db, organizer, { title: "Отдел", budgetText: "", exchangeDate: "2026-12-25", organizerName: "Оля" });
  if (!game.ok) throw new Error("setup");
  ({ joinCode, gameId } = game);
});

describe("mergeAnonymousUser", () => {
  test("merge moves lists, santa participation, reservations, purchases and deletes the anonymous user", async () => {
    const { userId: anon } = await createAnonymousUser(db, "Петя аноним");
    await joinSantaGame(db, joinCode, anon, "Петя");
    const other = await createWishlist(db, organizer, { title: "Оле", occasion: "birthday", eventDate: null });
    if (!other.ok) throw new Error("setup");
    const added = await addItem(db, organizer, other.wishlist.id, { title: "Книга", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!added.ok) throw new Error("setup");
    const reserved = await reserveItem(db, { slug: other.wishlist.slug, itemId: added.itemId, viewer: { userId: anon, guestToken: null }, guestName: "Петя" });
    expect(reserved.ok).toBe(true);
    await db.insert(designPurchases).values({ userId: anon, wishlistId: other.wishlist.id, product: "child", amountKopecks: 14900, email: "a@b.ru", status: "succeeded" });
    await db.insert(featureInterest).values({ userId: anon, feature: "santa" });

    await mergeAnonymousUser(db, anon, target);

    expect(await db.select().from(users).where(eq(users.id, anon))).toHaveLength(0);
    const view = await getSantaGameView(db, gameId, target);
    expect(view?.me.wishlistSlug).toBeTruthy();
    const lists = await db.select().from(wishlists).where(eq(wishlists.ownerId, target));
    expect(lists.map((l) => l.title)).toContain("Тайный Санта: Отдел");
    expect((await db.select().from(designPurchases).where(eq(designPurchases.userId, target)))).toHaveLength(1);
    expect((await db.select().from(featureInterest).where(eq(featureInterest.userId, target)))).toHaveLength(1);
    expect((await db.select().from(reservations).where(eq(reservations.guestUserId, target)))).toHaveLength(1);
  });

  test("merge keeps target settings", async () => {
    const { userId: anon } = await createAnonymousUser(db, "Другое имя");
    await mergeAnonymousUser(db, anon, target);
    const [row] = await db.select().from(users).where(eq(users.id, target));
    expect(row).toMatchObject({ displayName: "Петя", surpriseMode: true, isAnonymous: false });
  });

  test("merge with the same game before draw leaves one participant", async () => {
    const { userId: anon } = await createAnonymousUser(db, "Петя");
    await joinSantaGame(db, joinCode, anon, "Петя");
    await joinSantaGame(db, joinCode, target, "Петя");
    await mergeAnonymousUser(db, anon, target);
    const rows = await db.select().from(santaParticipants).where(eq(santaParticipants.gameId, gameId));
    expect(rows.filter((r) => r.userId === target)).toHaveLength(1);
  });

  test("merge with the same game after draw drops the duplicate and closes the circle", async () => {
    const { userId: anon } = await createAnonymousUser(db, "Петя");
    await joinSantaGame(db, joinCode, anon, "Петя");
    await joinSantaGame(db, joinCode, target, "Петя");
    await drawSantaGame(db, gameId, organizer);
    await mergeAnonymousUser(db, anon, target);
    const rows = await db.select().from(santaParticipants).where(eq(santaParticipants.gameId, gameId));
    expect(rows).toHaveLength(2);
    const ids = new Set(rows.map((r) => r.id));
    for (const row of rows) {
      expect(ids.has(row.recipientParticipantId!)).toBe(true);
      expect(row.recipientParticipantId).not.toBe(row.id);
    }
  });
});
