import { addItem, applyParseResult, createTestDb, createUserFixture, createWishlist, type Database, deleteItem, getBotItemCard } from "@wishlist/db/testing";
import { beforeEach, expect, test } from "vitest";
import type { Messenger, SendExtra } from "../telegram/messenger";
import { publicImageUrl, renderItemCard, updateItemCardMessage } from "./card";

const APP = "https://my-wish-list.online";
const BASE = "https://s3.twcstorage.ru/wishlist-image";
const WB = "https://www.wildberries.ru/catalog/1/detail.aspx";

let db: Database;
let owner: string;
let itemId: string;
let edits: { chatId: number; messageId: number; text: string; extra?: SendExtra }[];

const messenger: Messenger = {
  send: async () => "sent",
  edit: async (chatId, messageId, text, extra) => {
    edits.push({ chatId, messageId, text, extra });
    return "sent";
  },
};

beforeEach(async () => {
  db = await createTestDb();
  edits = [];
  owner = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  const added = await addItem(db, owner, list.wishlist.id, { title: "", sourceUrl: WB, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

test("publicImageUrl joins the bucket url and encodes the key", () => {
  expect(publicImageUrl("items/a b/p.webp", `${BASE}/`)).toBe(`${BASE}/items/a%20b/p.webp`);
  expect(publicImageUrl(null, BASE)).toBeNull();
  expect(publicImageUrl("items/x.webp", null)).toBeNull();
});

test("card with a photo shows it as a large preview above the text", async () => {
  await applyParseResult(db, itemId, WB, {
    normalizedUrl: WB,
    store: "wildberries",
    title: "Наушники",
    description: null,
    priceKopecks: 147200,
    imageKey: "items/i/p.webp",
  });
  const card = await getBotItemCard(db, itemId);
  const { text, extra } = renderItemCard(card!, { appUrl: APP, imagesPublicBaseUrl: BASE });
  expect(text).toContain("<b>Наушники</b>");
  expect(extra.link_preview_options).toEqual({ url: `${BASE}/items/i/p.jpg`, prefer_large_media: true, show_above_text: true });
  expect(extra.reply_markup?.inline_keyboard.flat().map((b) => b.text)).toEqual(["В список ▾", "Удалить", "Изменить"]);
});

test("card without a photo disables link previews", async () => {
  const card = await getBotItemCard(db, itemId);
  expect(renderItemCard(card!, { appUrl: APP, imagesPublicBaseUrl: BASE }).extra.link_preview_options).toEqual({ is_disabled: true });
});

test("after parsing the bot message is edited into the full card", async () => {
  await applyParseResult(db, itemId, WB, { normalizedUrl: WB, store: "wildberries", title: "Наушники", description: null, priceKopecks: null, imageKey: null });
  await updateItemCardMessage({ db, messenger, appUrl: APP, imagesPublicBaseUrl: BASE, log: () => undefined }, itemId, { chatId: 42, messageId: 7 });
  expect(edits).toHaveLength(1);
  expect(edits[0]).toMatchObject({ chatId: 42, messageId: 7 });
  expect(edits[0]!.text).toContain("Магазин не отдал цену");
});

test("a card deleted meanwhile is edited into a short note without buttons", async () => {
  await deleteItem(db, owner, itemId);
  await updateItemCardMessage({ db, messenger, appUrl: APP, imagesPublicBaseUrl: BASE, log: () => undefined }, itemId, { chatId: 42, messageId: 7 });
  expect(edits[0]!.text).toBe("Удалил «подарок» из списка «ДР».");
  expect(edits[0]!.extra?.reply_markup).toEqual({ inline_keyboard: [] });
});
