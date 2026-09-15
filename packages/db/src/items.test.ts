import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem, getOwnerWishlistView, type ItemInput, updateItem } from "./items";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { items, reservations, users } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { eq } from "drizzle-orm";
import { createWishlist } from "./wishlists";

let db: Database;
let owner: string;
let stranger: string;
let listId: string;

const headphones: ItemInput = {
  title: "Наушники",
  sourceUrl: "https://www.wildberries.ru/catalog/173937886/detail.aspx",
  priceKopecks: 2499000,
  note: "чёрные",
  isMustHave: false,
};

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Петя");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
});

async function added(input: ItemInput = headphones) {
  const result = await addItem(db, owner, listId, input);
  if (!result.ok) throw new Error(result.reason);
  return result.itemId;
}

describe("addItem", () => {
  test("adds a manual item and detects the store", async () => {
    await added();
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view?.items).toEqual([
      expect.objectContaining({ title: "Наушники", store: "wildberries", priceKopecks: 2499000, note: "чёрные", reserved: false, parseStatus: "pending", imageKey: null }),
    ]);
    expect(view?.wishlist.itemCount).toBe(1);
  });

  test("accepts items without link and price", async () => {
    await added({ title: "Сертификат в SPA", sourceUrl: null, priceKopecks: null, note: null, isMustHave: true });
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view?.items[0]).toMatchObject({ store: null, sourceUrl: null, priceKopecks: null });
  });

  test("refuses to add into someone else's list", async () => {
    expect(await addItem(db, stranger, listId, headphones)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await addItem(db, owner, "bad-id", headphones)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  test("stops at the per-list limit, ignoring deleted items", async () => {
    await db.insert(items).values(
      Array.from({ length: MAX_ITEMS_PER_WISHLIST }, (_, i) => ({ wishlistId: listId, title: `#${i}`, parseStatus: "ok" as const })),
    );
    expect(await addItem(db, owner, listId, headphones)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
    const [one] = await db.select({ id: items.id }).from(items).limit(1);
    await deleteItem(db, owner, one!.id);
    expect((await addItem(db, owner, listId, headphones)).ok).toBe(true);
  });
});

describe("updateItem / deleteItem", () => {
  test("owner edits and soft-deletes; stranger cannot", async () => {
    const id = await added();
    expect(await updateItem(db, stranger, id, { ...headphones, title: "Взлом" })).toEqual({ ok: false });
    expect(await deleteItem(db, stranger, id)).toBe(false);

    expect(await updateItem(db, owner, id, { ...headphones, title: "Наушники Sony", isMustHave: true, sourceUrl: null })).toEqual({ ok: true, needsParsing: false });
    expect((await getOwnerWishlistView(db, owner, listId))?.items[0]).toMatchObject({ title: "Наушники Sony", isMustHave: true, store: null });

    expect(await deleteItem(db, owner, id)).toBe(true);
    expect((await getOwnerWishlistView(db, owner, listId))?.items).toEqual([]);
    expect(await updateItem(db, owner, id, headphones)).toEqual({ ok: false });
  });

  test("malformed ids return false", async () => {
    expect(await updateItem(db, owner, "x", headphones)).toEqual({ ok: false });
    expect(await deleteItem(db, owner, "x")).toBe(false);
  });
});

describe("getOwnerWishlistView", () => {
  test("orders must-have first, then newest", async () => {
    await added({ ...headphones, title: "Старый" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await added({ ...headphones, title: "Новый" });
    await added({ ...headphones, title: "Мечта", isMustHave: true });
    const titles = (await getOwnerWishlistView(db, owner, listId))?.items.map((i) => i.title);
    expect(titles).toEqual(["Мечта", "Новый", "Старый"]);
  });

  test("returns null for a stranger", async () => {
    expect(await getOwnerWishlistView(db, stranger, listId)).toBeNull();
  });

  test("PRIVACY: shows only a reserved flag and never guest data", async () => {
    const id = await added();
    await db.insert(reservations).values({
      itemId: id, guestName: "СекретнаяАня", guestToken: "tok-secret", cancelToken: "cancel-secret", guestUserId: stranger,
    });
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view?.items[0]?.reserved).toBe(true);
    const json = JSON.stringify(view);
    for (const secret of ["СекретнаяАня", "tok-secret", "cancel-secret", stranger]) expect(json).not.toContain(secret);
  });

  test("PRIVACY: surprise mode hides even the reserved flag", async () => {
    const id = await added();
    await db.insert(reservations).values({ itemId: id, guestName: "Аня", guestToken: "t", cancelToken: "c" });
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    const view = await getOwnerWishlistView(db, owner, listId);
    expect(view).toMatchObject({ surpriseMode: true });
    expect(view?.items[0]?.reserved).toBe(false);
  });

  test("cancelled reservations do not count", async () => {
    const id = await added();
    await db.insert(reservations).values({ itemId: id, guestName: "Аня", guestToken: "t", cancelToken: "c", status: "cancelled" });
    expect((await getOwnerWishlistView(db, owner, listId))?.items[0]?.reserved).toBe(false);
  });
});
