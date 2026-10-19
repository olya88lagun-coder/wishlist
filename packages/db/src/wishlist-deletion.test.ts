import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, expect, test } from "vitest";
import { createTestDb, createUserFixture } from "./testing";
import type { Database } from "./types";
import { authIdentities, items, reservations, users, wishlistDeletionNotices } from "./schema";
import { createWishlist, deleteWishlist, getOwnedWishlist } from "./wishlists";

let db: Database;
let owner: string;
let guest: string;
let other: string;
let listId: string;
let giftId: string;
let sequence = 1;
beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => {
  await db.delete(wishlistDeletionNotices);
  owner = await createUserFixture(db, "Владелец");
  guest = await createUserFixture(db, "Даритель");
  other = await createUserFixture(db, "Другой");
  await db.insert(authIdentities).values({ userId: guest, provider: "telegram", providerUserId: String(sequence++) });
  const list = await createWishlist(db, owner, { title: "Частный праздник <для друзей>", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("fixture");
  listId = list.wishlist.id;
  const [gift] = await db.insert(items).values({ wishlistId: listId, title: "Подарок", parseStatus: "ok" }).returning();
  giftId = gift!.id;
  await db.insert(reservations).values({ itemId: giftId, guestUserId: guest, guestName: "Секретное имя", cancelToken: `cancel-${sequence++}` });
});

test("migrations create durable storage for notices that survive wishlist deletion", async () => {
  const result = await db.execute(sql`select to_regclass('public.wishlist_deletion_notices')::text as table_name`);
  expect(JSON.stringify(result)).toContain('"table_name":"wishlist_deletion_notices"');
});

test("deletion atomically saves one notice per connected guest before cascading reservations", async () => {
  const [second] = await db.insert(items).values({ wishlistId: listId, title: "Второй подарок", parseStatus: "ok" }).returning();
  await db.insert(reservations).values({ itemId: second!.id, guestUserId: guest, guestName: "Секретное имя", cancelToken: `cancel-${sequence++}` });
  expect(await deleteWishlist(db, owner, listId)).toBe(true);
  expect(await getOwnedWishlist(db, owner, listId)).toBeNull();
  expect(await db.select().from(items).where(eq(items.wishlistId, listId))).toEqual([]);
  const saved = await db.select().from(wishlistDeletionNotices);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ wishlistId: listId, guestUserId: guest, wishlistTitle: "Частный праздник <для друзей>", completedAt: null, attempts: 0 });
  expect(JSON.stringify(saved)).not.toContain("Секретное имя");
  expect(await db.select().from(reservations).where(eq(reservations.itemId, giftId))).toEqual([]);
});

test("unauthorized deletion saves no notice and leaves the list intact", async () => {
  expect(await deleteWishlist(db, other, listId)).toBe(false);
  expect(await getOwnedWishlist(db, owner, listId)).not.toBeNull();
  expect(await db.select().from(wishlistDeletionNotices)).toEqual([]);
});

test("anonymous, unconnected, cancelled and already deleted gifts create no notices", async () => {
  await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.itemId, giftId));
  const gifts = await db.insert(items).values([
    { wishlistId: listId, title: "Анонимный" },
    { wishlistId: listId, title: "Без Telegram" },
    { wishlistId: listId, title: "Удалённый", deletedAt: new Date() },
  ]).returning();
  await db.insert(reservations).values([
    { itemId: gifts[0]!.id, guestToken: "anonymous", guestName: "Аноним", cancelToken: `cancel-${sequence++}` },
    { itemId: gifts[1]!.id, guestUserId: other, guestName: "Другой", cancelToken: `cancel-${sequence++}` },
    { itemId: gifts[2]!.id, guestUserId: guest, guestName: "Даритель", cancelToken: `cancel-${sequence++}` },
  ]);
  expect(await deleteWishlist(db, owner, listId)).toBe(true);
  expect(await db.select().from(wishlistDeletionNotices)).toEqual([]);
});

test("deleting an empty list and repeating a deletion do not create notifications", async () => {
  await db.delete(items).where(eq(items.wishlistId, listId));
  expect(await deleteWishlist(db, owner, listId)).toBe(true);
  expect(await deleteWishlist(db, owner, listId)).toBe(false);
  expect(await db.select().from(wishlistDeletionNotices)).toEqual([]);
});

test("a failed outbox write rolls the entire deletion back", async () => {
  await db.execute(sql`create function reject_deletion_notice() returns trigger language plpgsql as $$ begin raise exception 'outbox unavailable'; end $$`);
  await db.execute(sql`create trigger reject_notice before insert on wishlist_deletion_notices for each row execute function reject_deletion_notice()`);
  try {
    await expect(deleteWishlist(db, owner, listId)).rejects.toThrow();
    expect(await getOwnedWishlist(db, owner, listId)).not.toBeNull();
    expect(await db.select().from(reservations).where(eq(reservations.itemId, giftId))).toHaveLength(1);
    expect(await db.select().from(wishlistDeletionNotices)).toEqual([]);
  } finally {
    await db.execute(sql`drop trigger reject_notice on wishlist_deletion_notices`);
    await db.execute(sql`drop function reject_deletion_notice()`);
  }
});

test("repeated deletion cannot duplicate the durable notice", async () => {
  expect(await deleteWishlist(db, owner, listId)).toBe(true);
  expect(await deleteWishlist(db, owner, listId)).toBe(false);
  expect(await db.select().from(wishlistDeletionNotices)).toHaveLength(1);
});

test("deleting the recipient removes the remaining snapshot too", async () => {
  await deleteWishlist(db, owner, listId);
  expect(await db.select().from(wishlistDeletionNotices)).toHaveLength(1);
  await db.delete(users).where(eq(users.id, guest));
  expect(await db.select().from(wishlistDeletionNotices)).toEqual([]);
});
