# Task 7: Добавление подарка ссылкой и кнопки под карточкой

**Files:**
- Create: `apps/worker/src/bot/add-links.ts`, `apps/worker/src/bot/callbacks.ts`
- Test: `apps/worker/src/bot/add-links.test.ts`, `apps/worker/src/bot/callbacks.test.ts`
- Modify: `apps/worker/src/bot/create-bot.ts`

**Interfaces:**
- Consumes: `extractLinks`, `MessageEntityLike` (Task 3); тексты `NO_LINK_TEXT`, `NO_LISTS_TEXT`, `limitReachedText`, `itemDeletedByOwnerText`, `RESERVATION_CANCELLED_TEXT` (Task 3); `CALLBACK`, `openAppKeyboard`, `itemCardKeyboard`, `listChoiceKeyboard` (Task 6); `renderItemCard`, `CardDeps` (Task 6); `ensureBotUser`, `BotReply` (Task 6); из `@wishlist/db` — `addItem`, `deleteItem`, `listWishlistsForOwner`, `getBotItemCard`, `moveItem`, `cancelReservationForUser`.
- Produces:
  ```ts
  // bot/add-links.ts
  type AddLinksDeps = CardDeps & { db: Database; enqueueParse(job: ParseItemJob): Promise<void>; reply(text: string, extra: SendExtra): Promise<{ message_id: number }>; chatId: number };
  function addLinksFromMessage(deps: AddLinksDeps, userId: string, text: string, entities?: readonly MessageEntityLike[]): Promise<void>;
  // bot/callbacks.ts
  type CallbackOutcome =
    | { kind: "edit"; text: string; extra: SendExtra }
    | { kind: "markup"; markup: InlineKeyboardMarkup }
    | { kind: "toast"; text: string };
  type CallbackDeps = CardDeps & { db: Database; enqueueNotify(job: NotifyJob): Promise<void> };
  function handleCallback(deps: CallbackDeps, userId: string, data: string): Promise<CallbackOutcome>;
  ```

Подарок из бота кладётся в **последний созданный** список владельца (`listWishlistsForOwner` сортирует по `created_at desc`); перенос — кнопкой «В список ▾». Список кнопок переноса строится тем же запросом, поэтому индекс в `to:<itemId>:<n>` указывает на тот же список, что показан на кнопке.

- [x] **Step 1: Добавление ссылкой — тест (падает)**

`apps/worker/src/bot/add-links.test.ts`:
```ts
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
  expect(view?.items.map((i) => ({ sourceUrl: i.sourceUrl, parseStatus: i.parseStatus })).sort((a, b) => a.sourceUrl!.localeCompare(b.sourceUrl!))).toEqual([
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
  await db.insert(items).values(Array.from({ length: MAX_ITEMS_PER_WISHLIST }, (_, i) => ({ wishlistId: list.wishlist.id, title: `#${i}`, parseStatus: "ok" as const })));
  await addLinksFromMessage(deps(), owner, `${WB} ${GA}`);
  expect(replies.map((r) => r.text)).toEqual(["В списке «ДР» уже максимум подарков. Перенесите или удалите лишние в приложении."]);
  expect(jobs).toEqual([]);
});
```

Run: `pnpm vitest run apps/worker/src/bot/add-links.test.ts`
Expected: FAIL — `Failed to resolve import "./add-links"`.

- [x] **Step 2: Добавление ссылкой — реализация**

`apps/worker/src/bot/add-links.ts`:
```ts
import type { ParseItemJob } from "@wishlist/core";
import { addItem, type Database, getBotItemCard, listWishlistsForOwner } from "@wishlist/db";
import type { SendExtra } from "../telegram/messenger";
import { type CardDeps, renderItemCard } from "./card";
import { openAppKeyboard } from "./keyboards";
import { extractLinks, type MessageEntityLike } from "./links";
import { limitReachedText, NO_LINK_TEXT, NO_LISTS_TEXT } from "./texts";

export type AddLinksDeps = CardDeps & {
  db: Database;
  chatId: number;
  enqueueParse(job: ParseItemJob): Promise<void>;
  reply(text: string, extra: SendExtra): Promise<{ message_id: number }>;
};

export async function addLinksFromMessage(deps: AddLinksDeps, userId: string, text: string, entities: readonly MessageEntityLike[] = []): Promise<void> {
  const links = extractLinks(text, entities);
  if (links.length === 0) {
    await deps.reply(NO_LINK_TEXT, {});
    return;
  }
  const [list] = await listWishlistsForOwner(deps.db, userId);
  if (!list) {
    await deps.reply(NO_LISTS_TEXT, { reply_markup: openAppKeyboard(deps.appUrl) });
    return;
  }
  for (const sourceUrl of links) {
    const added = await addItem(deps.db, userId, list.id, { title: "", sourceUrl, priceKopecks: null, note: null, isMustHave: false });
    if (!added.ok) {
      await deps.reply(limitReachedText(list.title), {});
      return;
    }
    const card = await getBotItemCard(deps.db, added.itemId);
    if (!card) continue;
    const message = renderItemCard(card, deps);
    const sent = await deps.reply(message.text, message.extra);
    await deps.enqueueParse({ itemId: added.itemId, botMessage: { chatId: deps.chatId, messageId: sent.message_id } });
  }
}
```

Run: `pnpm vitest run apps/worker/src/bot/add-links.test.ts`
Expected: PASS (4 теста).

- [x] **Step 3: Кнопки — тест (падает)**

`apps/worker/src/bot/callbacks.test.ts`:
```ts
import type { NotifyJob } from "@wishlist/core";
import {
  addItem,
  createTestDb,
  createUserFixture,
  createWishlist,
  type Database,
  getBotItemCard,
  reservations,
} from "@wishlist/db/testing";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { cancelReservationCallback } from "../notify";
import { type CallbackDeps, handleCallback } from "./callbacks";

let db: Database;
let owner: string;
let stranger: string;
let oldList: string;
let newList: string;
let itemId: string;
let notices: NotifyJob[];

function deps(): CallbackDeps {
  return { db, appUrl: "https://my-wish-list.online", imagesPublicBaseUrl: null, enqueueNotify: async (job) => void notices.push(job) };
}

beforeEach(async () => {
  db = await createTestDb();
  notices = [];
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Оля");
  const a = await createWishlist(db, owner, { title: "Новый год", occasion: "new_year", eventDate: null });
  const b = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!a.ok || !b.ok) throw new Error("setup");
  oldList = a.wishlist.id;
  newList = b.wishlist.id;
  const added = await addItem(db, owner, newList, { title: "Свеча", sourceUrl: null, priceKopecks: 99000, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

describe("moving between lists", () => {
  test("shows the owner's lists newest first, moves on choice and returns the card", async () => {
    const choice = await handleCallback(deps(), owner, `mv:${itemId}`);
    expect(choice).toEqual({
      kind: "markup",
      markup: {
        inline_keyboard: [
          [{ text: "ДР", callback_data: `to:${itemId}:0` }],
          [{ text: "Новый год", callback_data: `to:${itemId}:1` }],
          [{ text: "← Назад", callback_data: `bk:${itemId}` }],
        ],
      },
    });
    const moved = await handleCallback(deps(), owner, `to:${itemId}:1`);
    expect(moved).toMatchObject({ kind: "edit", text: expect.stringContaining("В списке «Новый год»") });
    expect((await getBotItemCard(db, itemId))?.wishlistId).toBe(oldList);
  });

  test("back restores the card buttons", async () => {
    const back = await handleCallback(deps(), owner, `bk:${itemId}`);
    expect(back.kind).toBe("markup");
    if (back.kind === "markup") expect(back.markup.inline_keyboard.flat().map((b) => b.text)).toEqual(["В список ▾", "Удалить", "Изменить"]);
  });

  test("strangers and stale buttons get a toast and change nothing", async () => {
    expect(await handleCallback(deps(), stranger, `mv:${itemId}`)).toEqual({ kind: "toast", text: "Этот подарок уже недоступен" });
    expect(await handleCallback(deps(), stranger, `to:${itemId}:1`)).toEqual({ kind: "toast", text: "Этот подарок уже недоступен" });
    expect(await handleCallback(deps(), owner, `to:${itemId}:9`)).toEqual({ kind: "toast", text: "Список не найден — откройте выбор ещё раз" });
    expect(await handleCallback(deps(), owner, "whatever")).toEqual({ kind: "toast", text: "Кнопка устарела" });
    expect((await getBotItemCard(db, itemId))?.wishlistId).toBe(newList);
  });
});

test("delete removes the owner's item, notifies a possible guest and leaves a short note", async () => {
  expect(await handleCallback(deps(), stranger, `del:${itemId}`)).toEqual({ kind: "toast", text: "Этот подарок уже недоступен" });
  const result = await handleCallback(deps(), owner, `del:${itemId}`);
  expect(result).toEqual({ kind: "edit", text: "Удалил «Свеча» из списка «ДР».", extra: { reply_markup: { inline_keyboard: [] } } });
  expect((await getBotItemCard(db, itemId))?.deleted).toBe(true);
  expect(notices).toEqual([{ kind: "item_deleted", itemId }]);
});

test("guest cancels own reservation from the confirmation message", async () => {
  const [row] = await db.insert(reservations).values({ itemId, guestUserId: stranger, guestName: "Оля", cancelToken: "c1" }).returning({ id: reservations.id });
  expect(await handleCallback(deps(), owner, cancelReservationCallback(row!.id))).toEqual({ kind: "toast", text: "Бронь уже снята" });
  expect(await handleCallback(deps(), stranger, cancelReservationCallback(row!.id))).toEqual({
    kind: "edit",
    text: "Бронь снята — подарок снова свободен.",
    extra: { reply_markup: { inline_keyboard: [] } },
  });
  const [after] = await db.select({ status: reservations.status }).from(reservations).where(eq(reservations.id, row!.id));
  expect(after?.status).toBe("cancelled");
});
```

Run: `pnpm vitest run apps/worker/src/bot/callbacks.test.ts`
Expected: FAIL — `Failed to resolve import "./callbacks"`.

- [x] **Step 4: Кнопки — реализация**

`apps/worker/src/bot/callbacks.ts`:
```ts
import type { NotifyJob } from "@wishlist/core";
import { type BotItemCard, cancelReservationForUser, type Database, deleteItem, getBotItemCard, listWishlistsForOwner, moveItem } from "@wishlist/db";
import type { InlineKeyboardMarkup } from "grammy/types";
import type { SendExtra } from "../telegram/messenger";
import { type CardDeps, renderItemCard } from "./card";
import { CALLBACK, itemCardKeyboard, listChoiceKeyboard } from "./keyboards";
import { itemDeletedByOwnerText, limitReachedText, RESERVATION_CANCELLED_TEXT } from "./texts";

export type CallbackOutcome =
  | { kind: "edit"; text: string; extra: SendExtra }
  | { kind: "markup"; markup: InlineKeyboardMarkup }
  | { kind: "toast"; text: string };

export type CallbackDeps = CardDeps & { db: Database; enqueueNotify(job: NotifyJob): Promise<void> };

const GONE: CallbackOutcome = { kind: "toast", text: "Этот подарок уже недоступен" };
const STALE: CallbackOutcome = { kind: "toast", text: "Кнопка устарела" };
const NO_BUTTONS: SendExtra = { reply_markup: { inline_keyboard: [] } };
const CALLBACK_PATTERN = /^(mv|to|bk|del|cx):([0-9a-f-]{36})(?::(\d{1,2}))?$/;

async function ownedCard(deps: CallbackDeps, userId: string, itemId: string): Promise<BotItemCard | null> {
  const card = await getBotItemCard(deps.db, itemId);
  return card && !card.deleted && card.ownerId === userId ? card : null;
}

async function moveTo(deps: CallbackDeps, userId: string, card: BotItemCard, index: number): Promise<CallbackOutcome> {
  const target = (await listWishlistsForOwner(deps.db, userId))[index];
  if (!target) return { kind: "toast", text: "Список не найден — откройте выбор ещё раз" };
  const moved = await moveItem(deps.db, userId, card.id, target.id);
  if (moved === "limit_reached") return { kind: "toast", text: limitReachedText(target.title) };
  const updated = await getBotItemCard(deps.db, card.id);
  if (moved !== "moved" || !updated) return GONE;
  const message = renderItemCard(updated, deps);
  return { kind: "edit", text: message.text, extra: message.extra };
}

export async function handleCallback(deps: CallbackDeps, userId: string, data: string): Promise<CallbackOutcome> {
  const match = CALLBACK_PATTERN.exec(data);
  if (!match) return STALE;
  const [, action, id, index] = match as unknown as [string, string, string, string | undefined];

  if (action === "cx") {
    if (!(await cancelReservationForUser(deps.db, id, userId))) return { kind: "toast", text: "Бронь уже снята" };
    return { kind: "edit", text: RESERVATION_CANCELLED_TEXT, extra: NO_BUTTONS };
  }

  const card = await ownedCard(deps, userId, id);
  if (!card) return GONE;

  switch (action) {
    case CALLBACK.move:
      return { kind: "markup", markup: listChoiceKeyboard(card.id, await listWishlistsForOwner(deps.db, userId)) };
    case CALLBACK.back:
      return { kind: "markup", markup: itemCardKeyboard(card, deps.appUrl) };
    case CALLBACK.moveTo:
      return index === undefined ? STALE : moveTo(deps, userId, card, Number(index));
    case CALLBACK.remove:
      if (!(await deleteItem(deps.db, userId, card.id))) return GONE;
      await deps.enqueueNotify({ kind: "item_deleted", itemId: card.id });
      return { kind: "edit", text: itemDeletedByOwnerText(card), extra: NO_BUTTONS };
    default:
      return STALE;
  }
}
```

Run: `pnpm vitest run apps/worker/src/bot`
Expected: PASS.

- [x] **Step 5: Подключить к боту**

В `apps/worker/src/bot/create-bot.ts` добавить импорты:
```ts
import { addLinksFromMessage } from "./add-links";
import { handleCallback } from "./callbacks";
import { ensureBotUser } from "./start";
```
(`startReply` уже импортирован — объединить в один импорт из `./start`.)

И перед `bot.catch(...)` добавить обработчики:
```ts
  const cardDeps = { appUrl: deps.config.appUrl, imagesPublicBaseUrl: deps.imagesPublicBaseUrl };

  // Только личные сообщения: в группах бот не добавляет подарки
  bot.chatType("private").on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const userId = await ensureBotUser(deps.db, ctx.from);
    await addLinksFromMessage(
      {
        ...cardDeps,
        db: deps.db,
        chatId: ctx.chat.id,
        enqueueParse: deps.enqueueParse,
        reply: (text, extra) => ctx.reply(text, { parse_mode: "HTML", ...extra }),
      },
      userId,
      ctx.message.text,
      ctx.message.entities ?? [],
    );
  });

  bot.on("callback_query:data", async (ctx) => {
    const userId = await ensureBotUser(deps.db, ctx.from);
    const outcome = await handleCallback({ ...cardDeps, db: deps.db, enqueueNotify: deps.enqueueNotify }, userId, ctx.callbackQuery.data);
    if (outcome.kind === "toast") {
      await ctx.answerCallbackQuery({ text: outcome.text });
      return;
    }
    await ctx.answerCallbackQuery();
    if (outcome.kind === "markup") await ctx.editMessageReplyMarkup({ reply_markup: outcome.markup });
    else await ctx.editMessageText(outcome.text, { parse_mode: "HTML", ...outcome.extra });
  });
```

Run: `pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS. Если `ctx.reply` возвращает тип, не совместимый с `{ message_id: number }` — это `Message.TextMessage`, у него есть `message_id`; типы совпадают без приведения.

- [x] **Step 6: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): add gifts by sending links to the bot; move, delete and cancel from buttons"
```
