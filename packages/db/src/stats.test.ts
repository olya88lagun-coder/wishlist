import { eq } from "drizzle-orm";
import { beforeEach, expect, test } from "vitest";
import { recordAffiliateClick } from "./affiliate";
import { FEATURE_THEMES, registerInterest } from "./interest";
import { addItem, deleteItem } from "./items";
import { reservations, users, wishlists } from "./schema";
import { adminStats } from "./stats";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

// Всё, что создаёт тест, получает created_at = now(); «старое» задаётся явным update в прошлое
const SINCE = new Date(Date.now() - 60 * 60_000);
const BEFORE = new Date(Date.now() - 30 * 86_400_000);

let db: Database;

const add = async (owner: string, listId: string, title: string, sourceUrl: string | null = null) => {
  const added = await addItem(db, owner, listId, { title, sourceUrl, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  return added.itemId;
};

beforeEach(async () => {
  db = await createTestDb();
});

test("counts totals and what happened since the given moment", async () => {
  const old = await createUserFixture(db, "Старый");
  await db.update(users).set({ createdAt: BEFORE }).where(eq(users.id, old));
  const masha = await createUserFixture(db, "Маша");

  const oldList = await createWishlist(db, old, { title: "Старый список", occasion: "other", eventDate: null });
  const list = await createWishlist(db, masha, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!oldList.ok || !list.ok) throw new Error("setup");
  await db.update(wishlists).set({ createdAt: BEFORE }).where(eq(wishlists.id, oldList.wishlist.id));

  const wb = await add(masha, list.wishlist.id, "Наушники", "https://www.wildberries.ru/catalog/1/detail.aspx");
  const ga = await add(masha, list.wishlist.id, "Духи", "https://goldapple.ru/1-x");
  await add(masha, list.wishlist.id, "Книга");
  const deleted = await add(masha, list.wishlist.id, "Удалённый");
  await deleteItem(db, masha, deleted);

  await db.insert(reservations).values({ itemId: wb, guestToken: "t", guestName: "Оля", cancelToken: "c1" });
  await recordAffiliateClick(db, { itemId: wb, store: "wildberries" });
  await recordAffiliateClick(db, { itemId: wb, store: "wildberries" });
  await recordAffiliateClick(db, { itemId: ga, store: "goldapple" });
  await registerInterest(db, masha, FEATURE_THEMES);

  expect(await adminStats(db, SINCE)).toEqual({
    users: { total: 2, new: 1 },
    wishlists: { total: 2, new: 1, withThreeItems: 1, withReservations: 1 },
    items: { new: 3 },
    reservations: { new: 1 },
    storeVisits: {
      new: 3,
      byStore: [
        { store: "wildberries", count: 2 },
        { store: "goldapple", count: 1 },
      ],
    },
    themeInterest: 1,
  });
});

test("cancelled reservations and deleted items do not make a list 'with reservations'", async () => {
  const masha = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, masha, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  const a = await add(masha, list.wishlist.id, "Свеча");
  const b = await add(masha, list.wishlist.id, "Шарф");
  await db.insert(reservations).values({ itemId: a, guestToken: "t1", guestName: "Оля", cancelToken: "c-a", status: "cancelled" });
  await db.insert(reservations).values({ itemId: b, guestToken: "t2", guestName: "Петя", cancelToken: "c-b" });
  await deleteItem(db, masha, b);
  expect((await adminStats(db, SINCE)).wishlists.withReservations).toBe(0);
});
