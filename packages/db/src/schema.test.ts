import { beforeEach, describe, expect, test } from "vitest";
import { authIdentities, items, reservations, users, wishlists } from "./schema";
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
