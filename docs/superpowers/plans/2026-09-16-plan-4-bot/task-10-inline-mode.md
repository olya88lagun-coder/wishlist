# Task 10: Inline-режим — `@бот` в любом чате предлагает поделиться своим списком

**Files:**
- Create: `apps/worker/src/bot/inline.ts`
- Test: `apps/worker/src/bot/inline.test.ts`
- Modify: `apps/worker/src/bot/create-bot.ts`

**Interfaces:**
- Consumes: `findUserIdByTelegram`, `listWishlistsForOwner`, `WishlistSummary` (планы 2 и Task 2); `countdownLabel`, `daysUntil`, `pluralRu` из core; `escapeHtml`, `publicListUrl` (Task 3).
- Produces:
  ```ts
  const INLINE_START_PARAMETER = "inline";
  const MAX_INLINE_RESULTS = 20;
  function filterLists(lists: readonly WishlistSummary[], query: string): WishlistSummary[];
  function inlineListResult(list: WishlistSummary, appUrl: string, now: Date): InlineQueryResultArticle;
  type InlineAnswer = { results: InlineQueryResultArticle[]; options: { cache_time: number; is_personal: true; button?: { text: string; start_parameter: string } } };
  function answerInline(deps: { db: Database; appUrl: string; now: () => Date }, telegramId: number, query: string): Promise<InlineAnswer>;
  ```

Inline-режим включается в BotFather командой `/setinline` (Task 11). Ответ персональный (`is_personal`): каждый видит только свои списки. Пользователь без аккаунта или без списков видит кнопку «Создать вишлист», которая открывает личный чат с ботом (`/start inline` → приветствие с кнопкой приложения, Task 6).

- [x] **Step 1: Тест (падает)**

`apps/worker/src/bot/inline.test.ts`:
```ts
import { authIdentities, createTestDb, createUserFixture, createWishlist, type Database, type WishlistSummary } from "@wishlist/db/testing";
import { beforeEach, describe, expect, test } from "vitest";
import { answerInline, filterLists, inlineListResult, INLINE_START_PARAMETER } from "./inline";

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
      message_text: "<b>Маше &lt;30&gt;</b>\nМой вишлист: выбирайте подарок и бронируйте — я не узнаю, кто что дарит 🎁\nhttps://my-wish-list.online/AbCdEfGhIj",
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
    const expected = { results: [], options: { cache_time: 0, is_personal: true, button: { text: "Создать вишлист", start_parameter: INLINE_START_PARAMETER } } };
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
```

Run: `pnpm vitest run apps/worker/src/bot/inline.test.ts`
Expected: FAIL — `Failed to resolve import "./inline"`.

- [x] **Step 2: Реализация**

`apps/worker/src/bot/inline.ts`:
```ts
import { countdownLabel, daysUntil, pluralRu } from "@wishlist/core";
import { type Database, findUserIdByTelegram, listWishlistsForOwner, type WishlistSummary } from "@wishlist/db";
import type { InlineQueryResultArticle } from "grammy/types";
import { escapeHtml, publicListUrl } from "./texts";

export const INLINE_START_PARAMETER = "inline";
export const MAX_INLINE_RESULTS = 20;
const GIFT_FORMS = ["подарок", "подарка", "подарков"] as const;

export type InlineAnswer = {
  results: InlineQueryResultArticle[];
  options: { cache_time: number; is_personal: true; button?: { text: string; start_parameter: string } };
};

export function filterLists(lists: readonly WishlistSummary[], query: string): WishlistSummary[] {
  const needle = query.trim().toLowerCase();
  return needle === "" ? [...lists] : lists.filter((list) => list.title.toLowerCase().includes(needle));
}

export function inlineListResult(list: WishlistSummary, appUrl: string, now: Date): InlineQueryResultArticle {
  const url = publicListUrl(appUrl, list.slug);
  const days = daysUntil(list.eventDate, now);
  const count = `${list.itemCount} ${pluralRu(list.itemCount, GIFT_FORMS)}`;
  return {
    type: "article",
    id: list.id,
    title: list.title,
    description: days === null ? count : `${count} · ${countdownLabel(list.occasion, days)}`,
    input_message_content: {
      message_text: `<b>${escapeHtml(list.title)}</b>\nМой вишлист: выбирайте подарок и бронируйте — я не узнаю, кто что дарит 🎁\n${url}`,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    },
    reply_markup: { inline_keyboard: [[{ text: "Открыть вишлист", url }]] },
  };
}

export async function answerInline(deps: { db: Database; appUrl: string; now: () => Date }, telegramId: number, query: string): Promise<InlineAnswer> {
  const userId = await findUserIdByTelegram(deps.db, telegramId);
  const lists = userId ? await listWishlistsForOwner(deps.db, userId) : [];
  if (lists.length === 0) {
    return { results: [], options: { cache_time: 0, is_personal: true, button: { text: "Создать вишлист", start_parameter: INLINE_START_PARAMETER } } };
  }
  const now = deps.now();
  const results = filterLists(lists, query).slice(0, MAX_INLINE_RESULTS).map((list) => inlineListResult(list, deps.appUrl, now));
  return { results, options: { cache_time: 10, is_personal: true } };
}
```

Run: `pnpm vitest run apps/worker/src/bot/inline.test.ts`
Expected: PASS (5 тестов).

- [x] **Step 3: Подключить к боту**

В `apps/worker/src/bot/create-bot.ts` импорт:
```ts
import { answerInline } from "./inline";
```
и перед `bot.catch(...)`:
```ts
  bot.on("inline_query", async (ctx) => {
    const answer = await answerInline({ db: deps.db, appUrl: deps.config.appUrl, now: () => new Date() }, ctx.from.id, ctx.inlineQuery.query);
    await ctx.answerInlineQuery(answer.results, answer.options);
  });
```

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS. Если тип `options.button` не совпадает с `InlineQueryResultsButton` из grammY — использовать этот тип из `grammy/types` в `InlineAnswer`.

- [x] **Step 4: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): inline mode to share own wishlists in any chat"
```
