import type { ParseItemJob } from "@wishlist/core";
import { createTestDb, createUserFixture, createWishlist, type Database, getOwnerWishlistView, items, MAX_ITEMS_PER_WISHLIST } from "@wishlist/db/testing";
import { beforeEach, expect, test } from "vitest";
import type { SendExtra } from "../telegram/messenger";
import { type AddLinksDeps, addLinksFromMessage } from "./add-links";
import { NO_LINK_TEXT, NO_LISTS_TEXT } from "./texts";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";
const GA = "https://goldapple.ru/19000378828-cardamom-moss";

let db: Database;
let owner: string;
let replies: { text: string; extra: SendExtra }[];
let jobs: ParseItemJob[];

function deps(): AddLinksDeps {
  return {
    db,
    appUrl: "https://my-wish-list.online",
    imagesPublicBaseUrl: null,
    chatId: 42,
    enqueueParse: async (job) => void jobs.push(job),
    reply: async (text, extra) => {
      replies.push({ text, extra });
      return { message_id: 100 + replies.length };
    },
  };
}

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  replies = [];
  jobs = [];
});

test("a message without links gets a hint", async () => {
  await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  await addLinksFromMessage(deps(), owner, "привет");
  expect(replies.map((r) => r.text)).toEqual([NO_LINK_TEXT]);
});

test("without lists the bot asks to create one first", async () => {
  await addLinksFromMessage(deps(), owner, WB);
  expect(replies).toEqual([{ text: NO_LISTS_TEXT, extra: { reply_markup: expect.any(Object) } }]);
  expect(jobs).toEqual([]);
});

test("each link becomes a pending item in the newest list with its own card message", async () => {
  await createWishlist(db, owner, { title: "Старый", occasion: "other", eventDate: null });
  const newest = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!newest.ok) throw new Error("setup");

  await addLinksFromMessage(deps(), owner, `${WB}\n${GA}`);

  const view = await getOwnerWishlistView(db, owner, newest.wishlist.id);
  expect(
    view?.items
      .map((i) => ({ sourceUrl: i.sourceUrl, parseStatus: i.parseStatus }))
      .sort((a, b) => a.sourceUrl!.localeCompare(b.sourceUrl!)),
  ).toEqual([
    { sourceUrl: GA, parseStatus: "pending" },
    { sourceUrl: WB, parseStatus: "pending" },
  ]);
  expect(replies).toHaveLength(2);
  expect(replies[0]!.text).toContain("Загружаем данные из магазина");
  expect(replies[0]!.text).toContain("В списке «ДР»");
  expect(jobs.map((j) => j.botMessage)).toEqual([
    { chatId: 42, messageId: 101 },
    { chatId: 42, messageId: 102 },
  ]);
});

test("a full list stops adding and says so", async () => {
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  await db
    .insert(items)
    .values(Array.from({ length: MAX_ITEMS_PER_WISHLIST }, (_, i) => ({ wishlistId: list.wishlist.id, title: `#${i}`, parseStatus: "ok" as const })));
  await addLinksFromMessage(deps(), owner, `${WB} ${GA}`);
  expect(replies.map((r) => r.text)).toEqual(["В списке «ДР» уже максимум подарков. Перенесите или удалите лишние в приложении."]);
  expect(jobs).toEqual([]);
});
