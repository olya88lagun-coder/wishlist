import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem, getOwnerWishlistView, updateItem } from "./items";
import {
  applyParseResult,
  getItemForParsing,
  PARSE_CACHE_KEEP_MS,
  PARSE_CACHE_TTL_MS,
  type ParsedItemUpdate,
  pruneParseCache,
  readParseCache,
  writeParseCache,
} from "./parsing";
import { items, parseCache } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

let db: Database;
let owner: string;
let listId: string;

const parsed: ParsedItemUpdate = {
  normalizedUrl: WB,
  store: "wildberries",
  title: "Диффузор для дома",
  description: "Морская соль",
  priceKopecks: 289100,
  imageKey: "items/x/photo.webp",
};

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db);
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
});

async function linkOnly(url = WB) {
  const result = await addItem(db, owner, listId, { title: "", sourceUrl: url, priceKopecks: null, note: null, isMustHave: false });
  if (!result.ok) throw new Error(result.reason);
  expect(result.needsParsing).toBe(true);
  return result.itemId;
}

const viewItem = async () => (await getOwnerWishlistView(db, owner, listId))?.items[0];

describe("getItemForParsing", () => {
  test("returns pending items with a link only", async () => {
    const id = await linkOnly();
    expect(await getItemForParsing(db, id)).toEqual({ id, sourceUrl: WB, hasImage: false });

    const manual = await addItem(db, owner, listId, { title: "Сертификат", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!manual.ok) throw new Error("setup");
    expect(manual.needsParsing).toBe(false);
    expect(await getItemForParsing(db, manual.itemId)).toBeNull();

    await deleteItem(db, owner, id);
    expect(await getItemForParsing(db, id)).toBeNull();
    expect(await getItemForParsing(db, "not-a-uuid")).toBeNull();
  });
});

describe("applyParseResult", () => {
  test("fills an empty item and derives ok", async () => {
    const id = await linkOnly();
    expect(await applyParseResult(db, id, WB, parsed)).toBe(true);
    expect(await viewItem()).toMatchObject({ title: "Диффузор для дома", priceKopecks: 289100, imageKey: "items/x/photo.webp", parseStatus: "ok", store: "wildberries" });
    expect(await getItemForParsing(db, id)).toBeNull();
  });

  test("keeps what the owner typed while parsing was running", async () => {
    const id = await linkOnly();
    await db.update(items).set({ title: "Мой диффузор", priceKopecks: 250000 }).where(eq(items.id, id));
    await applyParseResult(db, id, WB, parsed);
    expect(await viewItem()).toMatchObject({ title: "Мой диффузор", priceKopecks: 250000, imageKey: "items/x/photo.webp", parseStatus: "ok" });
  });

  test("missing price is partial, missing title is failed", async () => {
    const partialId = await linkOnly();
    await applyParseResult(db, partialId, WB, { ...parsed, priceKopecks: null });
    expect(await viewItem()).toMatchObject({ parseStatus: "partial", priceKopecks: null });

    await deleteItem(db, owner, partialId);
    const failedId = await linkOnly();
    await applyParseResult(db, failedId, WB, { ...parsed, title: null, imageKey: null });
    expect(await viewItem()).toMatchObject({ parseStatus: "failed", title: "", priceKopecks: 289100 });
  });

  test("does nothing when the link changed, the item is gone or already parsed", async () => {
    const id = await linkOnly();
    expect(await applyParseResult(db, id, "https://goldapple.ru/other", parsed)).toBe(false);
    expect(await applyParseResult(db, id, WB, parsed)).toBe(true);
    expect(await applyParseResult(db, id, WB, { ...parsed, title: "Повтор" })).toBe(false);

    const deletedId = await linkOnly();
    await deleteItem(db, owner, deletedId);
    expect(await applyParseResult(db, deletedId, WB, parsed)).toBe(false);
  });
});

describe("updateItem and parsing", () => {
  const edit = { title: "Диффузор", sourceUrl: WB, priceKopecks: 289100, note: null, isMustHave: false };

  test("a new link sends the item back to parsing and drops the old photo", async () => {
    const id = await linkOnly();
    await applyParseResult(db, id, WB, parsed);
    const other = "https://goldapple.ru/19000180719-lip-mask";
    expect(await updateItem(db, owner, id, { ...edit, sourceUrl: other })).toEqual({ ok: true, needsParsing: true });
    expect(await viewItem()).toMatchObject({ parseStatus: "pending", imageKey: null, sourceUrl: other, store: "goldapple" });
  });

  test("editing other fields confirms the item as ok and keeps the photo", async () => {
    const id = await linkOnly();
    await applyParseResult(db, id, WB, { ...parsed, priceKopecks: null });
    expect(await updateItem(db, owner, id, edit)).toEqual({ ok: true, needsParsing: false });
    expect(await viewItem()).toMatchObject({ parseStatus: "ok", imageKey: "items/x/photo.webp", priceKopecks: 289100 });
  });

  test("removing the link drops the store photo", async () => {
    const id = await linkOnly();
    await applyParseResult(db, id, WB, parsed);
    expect(await updateItem(db, owner, id, { ...edit, sourceUrl: null })).toEqual({ ok: true, needsParsing: false });
    expect(await viewItem()).toMatchObject({ parseStatus: "ok", imageKey: null, store: null });
  });
});

describe("parse cache", () => {
  test("reads fresh entries, ignores stale ones, overwrites and prunes old rows", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    await writeParseCache(db, WB, { status: "ok", title: "Старое" }, now);
    await writeParseCache(db, WB, { status: "ok", title: "Новое" }, now);
    expect(await readParseCache(db, WB, new Date(now.getTime() + PARSE_CACHE_TTL_MS - 1))).toEqual({ status: "ok", title: "Новое" });
    expect(await readParseCache(db, WB, new Date(now.getTime() + PARSE_CACHE_TTL_MS + 1))).toBeNull();
    expect(await readParseCache(db, "https://nowhere.ru/", now)).toBeNull();

    await writeParseCache(db, "https://old.ru/", { status: "ok" }, new Date(now.getTime() - PARSE_CACHE_KEEP_MS - 1));
    expect(await pruneParseCache(db, now)).toBe(1);
    expect((await db.select().from(parseCache)).map((row) => row.normalizedUrl)).toEqual([WB]);
  });
});
