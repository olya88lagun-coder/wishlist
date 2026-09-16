import { authIdentities, createTestDb, createUserFixture, createWishlist, type Database, type WishlistSummary } from "@wishlist/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { answerInline, filterLists, INLINE_START_PARAMETER, inlineListResult } from "./inline";

const APP = "https://my-wish-list.online";
const NOW = new Date("2026-10-01T09:00:00Z");

const summary = (over: Partial<WishlistSummary>): WishlistSummary => ({
  id: "w1",
  title: "Маше 30",
  occasion: "birthday",
  eventDate: "2026-10-08",
  slug: "AbCdEfGhIj",
  itemCount: 3,
  ...over,
});

test("filterLists matches the query case-insensitively and keeps all for an empty query", () => {
  const lists = [summary({ id: "a", title: "Маше 30" }), summary({ id: "b", title: "Новый год <3>" })];
  expect(filterLists(lists, "").map((l) => l.id)).toEqual(["a", "b"]);
  expect(filterLists(lists, "  НОВЫЙ ").map((l) => l.id)).toEqual(["b"]);
});

test("a list becomes an article with the public link and a countdown", () => {
  expect(inlineListResult(summary({ title: "Маше <30>" }), APP, NOW)).toEqual({
    type: "article",
    id: "w1",
    title: "Маше <30>",
    description: "3 подарка · ДР через 7 дней",
    input_message_content: {
      message_text:
        "<b>Маше &lt;30&gt;</b>\nМой вишлист: выбирайте подарок и бронируйте — я не узнаю, кто что дарит 🎁\nhttps://my-wish-list.online/AbCdEfGhIj",
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    },
    reply_markup: { inline_keyboard: [[{ text: "Открыть вишлист", url: "https://my-wish-list.online/AbCdEfGhIj" }]] },
  });
  expect(inlineListResult(summary({ eventDate: null, itemCount: 0 }), APP, NOW).description).toBe("0 подарков");
});

describe("answerInline", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  test("strangers and users without lists get a button to create a wishlist", async () => {
    const expected = {
      results: [],
      options: { cache_time: 0, is_personal: true, button: { text: "Создать вишлист", start_parameter: INLINE_START_PARAMETER } },
    };
    expect(await answerInline({ db, appUrl: APP, now: () => NOW }, 999, "")).toEqual(expected);
    const user = await createUserFixture(db, "Маша");
    await db.insert(authIdentities).values({ userId: user, provider: "telegram", providerUserId: "999" });
    expect(await answerInline({ db, appUrl: APP, now: () => NOW }, 999, "")).toEqual(expected);
  });

  test("owners get only their own lists, newest first", async () => {
    const masha = await createUserFixture(db, "Маша");
    const olya = await createUserFixture(db, "Оля");
    await db.insert(authIdentities).values({ userId: masha, provider: "telegram", providerUserId: "999" });
    await createWishlist(db, masha, { title: "Новый год", occasion: "new_year", eventDate: null });
    await createWishlist(db, masha, { title: "ДР", occasion: "birthday", eventDate: null });
    await createWishlist(db, olya, { title: "Чужой", occasion: "other", eventDate: null });
    const answer = await answerInline({ db, appUrl: APP, now: () => NOW }, 999, "");
    expect(answer.results.map((r) => r.title)).toEqual(["ДР", "Новый год"]);
    expect(answer.options).toEqual({ cache_time: 10, is_personal: true });
  });
});
