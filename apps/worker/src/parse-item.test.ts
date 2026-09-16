import { addItem, createTestDb, createUserFixture, createWishlist, type Database, getOwnerWishlistView, readParseCache } from "@wishlist/db/testing";
import type { FetchedImage, ParseResult } from "@wishlist/parser";
import sharp from "sharp";
import { beforeEach, describe, expect, test } from "vitest";
import { runParseItem, type ParseItemDeps } from "./parse-item";
import type { ObjectStorage } from "./storage";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

const okResult: ParseResult = {
  status: "ok",
  store: "wildberries",
  finalUrl: WB,
  title: "Диффузор для дома",
  description: "Морская соль",
  imageUrl: "https://basket-01.wbbasket.ru/big/1.webp",
  priceKopecks: 289100,
  currency: "RUB",
};

let db: Database;
let owner: string;
let listId: string;
let puts: { bucket: string; key: string; contentType: string; cacheControl?: string }[];
let parseCalls: string[];

function memoryStorage(): ObjectStorage {
  return {
    put: async (bucket, key, _body, options) => void puts.push({ bucket, key, ...options }),
    list: async () => [],
    remove: async () => undefined,
  };
}

async function deps(overrides: Partial<ParseItemDeps> = {}): Promise<ParseItemDeps> {
  const photo = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#ffe66d" } }).png().toBuffer();
  return {
    db,
    parse: async (url) => {
      parseCalls.push(url);
      return okResult;
    },
    fetchImage: async (): Promise<FetchedImage> => ({ ok: true, bytes: photo, contentType: "image/png" }),
    images: { storage: memoryStorage(), bucket: "wishlist-images" },
    log: () => undefined,
    ...overrides,
  };
}

async function linkItem(url = WB) {
  const result = await addItem(db, owner, listId, { title: "", sourceUrl: url, priceKopecks: null, note: null, isMustHave: false });
  if (!result.ok) throw new Error(result.reason);
  return result.itemId;
}

const itemView = async () => (await getOwnerWishlistView(db, owner, listId))?.items[0];

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db);
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
  puts = [];
  parseCalls = [];
});

describe("runParseItem", () => {
  test("parses, stores the photo as immutable webp with a jpeg copy for the bot and fills the item", async () => {
    const id = await linkItem();
    expect(await runParseItem(id, await deps())).toBe("applied");
    expect(puts).toEqual([
      { bucket: "wishlist-images", key: expect.stringMatching(new RegExp(`^items/${id}/[0-9a-f-]{36}\\.webp$`)), contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
      { bucket: "wishlist-images", key: puts[0]!.key.replace(/\.webp$/, ".jpg"), contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" },
    ]);
    expect(await itemView()).toMatchObject({ title: "Диффузор для дома", priceKopecks: 289100, imageKey: puts[0]!.key, parseStatus: "ok" });
    expect(await readParseCache(db, WB)).toMatchObject({ title: "Диффузор для дома", status: "ok" });
  });

  test("uses the 24h cache instead of parsing the same link again", async () => {
    await runParseItem(await linkItem(), await deps());
    await runParseItem(await linkItem(), await deps());
    expect(parseCalls).toEqual([WB]);
  });

  test("skips items that are not pending anymore", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps());
    expect(await runParseItem(id, await deps())).toBe("skipped");
    expect(parseCalls).toHaveLength(1);
  });

  test("a photo that fails to load does not block the text data", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps({ fetchImage: async () => ({ ok: false, reason: "timeout" }) }));
    expect(await itemView()).toMatchObject({ title: "Диффузор для дома", imageKey: null, parseStatus: "ok" });
    expect(puts).toEqual([]);
  });

  test("works without S3 configured (local development)", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps({ images: null }));
    expect(await itemView()).toMatchObject({ imageKey: null, parseStatus: "ok" });
  });

  test("failed parses are not cached and a crashing parser marks the item failed", async () => {
    const id = await linkItem();
    await runParseItem(id, await deps({ parse: async () => { throw new Error("boom"); } }));
    expect(await itemView()).toMatchObject({ parseStatus: "failed", title: "" });
    expect(await readParseCache(db, WB)).toBeNull();
  });
});
