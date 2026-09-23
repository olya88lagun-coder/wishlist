import { beforeEach, expect, test } from "vitest";
import { getGoTarget, recordAffiliateClick, recordStoreSearchClick } from "./affiliate";
import { addItem, deleteItem } from "./items";
import { affiliateClicks, storeSearchClicks } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

const WB = "https://www.wildberries.ru/catalog/1/detail.aspx";

let db: Database;
let owner: string;
let listId: string;
let itemId: string;

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
  const added = await addItem(db, owner, listId, { title: "Наушники", sourceUrl: WB, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

test("go target is the item's own link, its store and owner", async () => {
  expect(await getGoTarget(db, itemId)).toEqual({ itemId, ownerId: owner, sourceUrl: WB, store: "wildberries" });
  expect(await getGoTarget(db, "not-a-uuid")).toBeNull();
});

test("deleted items and items without a link have nowhere to go", async () => {
  const manual = await addItem(db, owner, listId, { title: "Книга", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!manual.ok) throw new Error("setup");
  expect(await getGoTarget(db, manual.itemId)).toBeNull();
  await deleteItem(db, owner, itemId);
  expect(await getGoTarget(db, itemId)).toBeNull();
});

test("clicks are stored per item and store only", async () => {
  await recordAffiliateClick(db, { itemId, store: "wildberries" });
  const rows = await db.select().from(affiliateClicks);
  expect(rows).toHaveLength(1);
  expect(Object.keys(rows[0]!).sort()).toEqual(["clickedAt", "id", "itemId", "store"]);
});

test("записывает переход в поиск магазина и обрезает длинные значения", async () => {
  await recordStoreSearchClick(db, { store: "ozon", source: "gifts/for-mom", query: "плед из хлопка" });
  await recordStoreSearchClick(db, { store: "wildberries", source: "f".repeat(100), query: "q".repeat(300) });

  const rows = await db.select().from(storeSearchClicks);
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row.store === "ozon")).toMatchObject({ source: "gifts/for-mom", query: "плед из хлопка" });
  const long = rows.find((row) => row.store === "wildberries");
  expect(long?.source).toHaveLength(60);
  expect(long?.query).toHaveLength(160);
});
