import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { authIdentities, items, reservations, santaGames, santaParticipants, users, wishlists } from "./schema";
import { createTestDb } from "./testing";
import type { Database } from "./types";

let db: Database;
let itemId: string;

beforeEach(async () => {
  db = await createTestDb();
  const [owner] = await db.insert(users).values({ displayName: "Маша" }).returning();
  const [list] = await db.insert(wishlists).values({ ownerId: owner!.id, title: "Маше 30", slug: "abc123" }).returning();
  const [item] = await db.insert(items).values({ wishlistId: list!.id, title: "Наушники" }).returning();
  itemId = item!.id;
});

describe("reservations constraints", () => {
  test("rejects a second active reservation for the same item", async () => {
    await db.insert(reservations).values({ itemId, guestName: "Аня", guestToken: "t1", cancelToken: "c1" });
    await expect(
      db.insert(reservations).values({ itemId, guestName: "Петя", guestToken: "t2", cancelToken: "c2" }),
    ).rejects.toThrow();
  });

  test("allows a new active reservation after the previous one is cancelled", async () => {
    await db.insert(reservations).values({ itemId, guestName: "Аня", guestToken: "t1", cancelToken: "c1", status: "cancelled" });
    await expect(
      db.insert(reservations).values({ itemId, guestName: "Петя", guestToken: "t2", cancelToken: "c2" }),
    ).resolves.toBeDefined();
  });
});

describe("auth identity constraints", () => {
  test("one provider account maps to exactly one user", async () => {
    const [u1] = await db.insert(users).values({ displayName: "A" }).returning();
    const [u2] = await db.insert(users).values({ displayName: "B" }).returning();
    await db.insert(authIdentities).values({ userId: u1!.id, provider: "vk", providerUserId: "777" });
    await expect(
      db.insert(authIdentities).values({ userId: u2!.id, provider: "vk", providerUserId: "777" }),
    ).rejects.toThrow();
  });
});

describe("santa constraints", () => {
  test("santa tables accept a game with participants and reject a duplicate participant", async () => {
    const [organizer] = await db.insert(users).values({ displayName: "Оля" }).returning();
    const [guest] = await db.insert(users).values({ displayName: "Гость", isAnonymous: true }).returning();
    expect(guest!.isAnonymous).toBe(true);
    expect(guest!.sessionVersion).toBe(0);
    const [list] = await db.insert(wishlists).values({ ownerId: guest!.id, title: "Тайный Санта: Отдел", slug: "santa1", occasion: "new_year" }).returning();
    const [game] = await db.insert(santaGames).values({
      organizerId: organizer!.id, title: "Отдел", budgetText: "до 1 500 ₽", exchangeDate: "2026-12-25", joinCode: "code1",
    }).returning();
    expect(game!.status).toBe("open");
    await db.insert(santaParticipants).values({ gameId: game!.id, userId: organizer!.id, displayName: "Оля" });
    await db.insert(santaParticipants).values({ gameId: game!.id, userId: guest!.id, wishlistId: list!.id, displayName: "Гость" });
    await expect(
      db.insert(santaParticipants).values({ gameId: game!.id, userId: guest!.id, displayName: "Дубль" }),
    ).rejects.toThrow();

    await db.delete(wishlists).where(eq(wishlists.id, list!.id));
    const [afterListDelete] = await db.select().from(santaParticipants).where(eq(santaParticipants.userId, guest!.id));
    expect(afterListDelete!.wishlistId).toBeNull();

    await db.delete(santaGames).where(eq(santaGames.id, game!.id));
    expect(await db.select().from(santaParticipants)).toHaveLength(0);
  });
});
