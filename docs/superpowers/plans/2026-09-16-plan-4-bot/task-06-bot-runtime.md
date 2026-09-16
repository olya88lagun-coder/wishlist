# Task 6: Бот в воркере — запуск, `/start`, карточка после парсинга, регистрация задач

**Files:**
- Create: `apps/worker/src/bot/keyboards.ts`, `apps/worker/src/bot/card.ts`, `apps/worker/src/bot/start.ts`, `apps/worker/src/bot/create-bot.ts`, `apps/worker/src/jobs.ts`
- Test: `apps/worker/src/bot/card.test.ts`, `apps/worker/src/bot/start.test.ts`
- Modify: `apps/worker/src/main.ts` (заменить целиком)

**Interfaces:**
- Consumes: `getBotItemCard`, `attachReservationToUser`, `upsertUserFromIdentity`, `BotItemCard`, `WishlistSummary` из `@wishlist/db`; `verifyReminderPayload`, `BotMessageRef`, `ParseItemJob`, `NotifyJob`, `QUEUES`, `PARSE_JOB_OPTIONS`, `NOTIFY_JOB_OPTIONS` из core; тексты (Task 3); `Messenger`, `createMessenger`, `SendExtra` (Task 4); `runNotify` (Task 4); `runParseItem` (план 3); `TelegramConfig`, `S3Config` (Task 4).
- Produces:
  ```ts
  // bot/keyboards.ts — чистые объекты InlineKeyboardMarkup
  const CALLBACK = { move: "mv", moveTo: "to", back: "bk", remove: "del" } as const;
  function openAppKeyboard(appUrl: string): InlineKeyboardMarkup;
  function itemCardKeyboard(card: Pick<BotItemCard, "id" | "wishlistId">, appUrl: string): InlineKeyboardMarkup;
  function listChoiceKeyboard(itemId: string, lists: readonly Pick<WishlistSummary, "title">[]): InlineKeyboardMarkup;
  // bot/card.ts
  type CardDeps = { appUrl: string; imagesPublicBaseUrl: string | null };
  function publicImageUrl(imageKey: string | null, baseUrl: string | null): string | null;
  function renderItemCard(card: BotItemCard, deps: CardDeps): { text: string; extra: SendExtra };
  function updateItemCardMessage(deps: CardDeps & { db: Database; messenger: Messenger; log: Logger }, itemId: string, ref: BotMessageRef): Promise<void>;
  // bot/start.ts
  type TelegramFrom = { id: number; first_name: string; last_name?: string; username?: string };
  function ensureBotUser(db: Database, from: TelegramFrom): Promise<string>; // userId
  type BotReply = { text: string; extra: SendExtra };
  function startReply(deps: { db: Database; appUrl: string; sessionSecret: string }, from: TelegramFrom, payload: string): Promise<BotReply>;
  // bot/create-bot.ts
  type BotDeps = { config: TelegramConfig; db: Database; log: Logger; imagesPublicBaseUrl: string | null; enqueueParse(job: ParseItemJob): Promise<void>; enqueueNotify(job: NotifyJob): Promise<void> };
  function createTelegramBot(deps: BotDeps): Promise<Bot | null>; // null — токен не принят
  // jobs.ts
  type JobDeps = { db: Database; databaseUrl: string; fetcher: SafeFetcher; waitTurn(url: string): Promise<void>; storage: ObjectStorage | null; s3: S3Config | null; telegram: TelegramConfig | null; imagesPublicBaseUrl: string | null; messenger: Messenger | null; log: Logger };
  function registerJobs(boss: PgBoss, deps: JobDeps): Promise<void>;
  ```

Логика — в `card.ts` и `start.ts` (тесты без Telegram). `create-bot.ts`, `jobs.ts` и `main.ts` только соединяют части; их проверяют typecheck, сборка и прод (Task 11).

- [x] **Step 1: Клавиатуры**

`apps/worker/src/bot/keyboards.ts`:
```ts
import type { BotItemCard, WishlistSummary } from "@wishlist/db";
import type { InlineKeyboardMarkup } from "grammy/types";
import { miniAppUrl } from "./texts";

// callback_data ≤ 64 байт: префикс + uuid (36) + индекс списка
export const CALLBACK = { move: "mv", moveTo: "to", back: "bk", remove: "del" } as const;
const MAX_LIST_BUTTONS = 8;

export function openAppKeyboard(appUrl: string): InlineKeyboardMarkup {
  return { inline_keyboard: [[{ text: "Открыть вишлист", web_app: { url: miniAppUrl(appUrl) } }]] };
}

export function itemCardKeyboard(card: Pick<BotItemCard, "id" | "wishlistId">, appUrl: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "В список ▾", callback_data: `${CALLBACK.move}:${card.id}` },
        { text: "Удалить", callback_data: `${CALLBACK.remove}:${card.id}` },
      ],
      [{ text: "Изменить", web_app: { url: miniAppUrl(appUrl, `/lists/${card.wishlistId}`) } }],
    ],
  };
}

export function listChoiceKeyboard(itemId: string, lists: readonly Pick<WishlistSummary, "title">[]): InlineKeyboardMarkup {
  const rows = lists.slice(0, MAX_LIST_BUTTONS).map((list, index) => [{ text: list.title, callback_data: `${CALLBACK.moveTo}:${itemId}:${index}` }]);
  return { inline_keyboard: [...rows, [{ text: "← Назад", callback_data: `${CALLBACK.back}:${itemId}` }]] };
}
```

- [x] **Step 2: Карточка — тест (падает)**

`apps/worker/src/bot/card.test.ts`:
```ts
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
  await applyParseResult(db, itemId, WB, { normalizedUrl: WB, store: "wildberries", title: "Наушники", description: null, priceKopecks: 147200, imageKey: "items/i/p.webp" });
  const card = await getBotItemCard(db, itemId);
  const { text, extra } = renderItemCard(card!, { appUrl: APP, imagesPublicBaseUrl: BASE });
  expect(text).toContain("<b>Наушники</b>");
  expect(extra.link_preview_options).toEqual({ url: `${BASE}/items/i/p.webp`, prefer_large_media: true, show_above_text: true });
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
```

Run: `pnpm vitest run apps/worker/src/bot/card.test.ts`
Expected: FAIL — `Failed to resolve import "./card"`.

- [x] **Step 3: Карточка — реализация**

`apps/worker/src/bot/card.ts`:
```ts
import type { BotMessageRef } from "@wishlist/core";
import { type BotItemCard, type Database, getBotItemCard } from "@wishlist/db";
import type { Logger } from "../log";
import type { Messenger, SendExtra } from "../telegram/messenger";
import { itemCardKeyboard } from "./keyboards";
import { itemCardText, itemDeletedByOwnerText } from "./texts";

export type CardDeps = { appUrl: string; imagesPublicBaseUrl: string | null };

export function publicImageUrl(imageKey: string | null, baseUrl: string | null): string | null {
  if (!imageKey || !baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, "")}/${imageKey.split("/").map(encodeURIComponent).join("/")}`;
}

// Фото показываем превью ссылки: так карточку можно редактировать текстом, не пересоздавая сообщение
export function renderItemCard(card: BotItemCard, deps: CardDeps): { text: string; extra: SendExtra } {
  const imageUrl = publicImageUrl(card.imageKey, deps.imagesPublicBaseUrl);
  return {
    text: itemCardText(card),
    extra: {
      reply_markup: itemCardKeyboard(card, deps.appUrl),
      link_preview_options: imageUrl ? { url: imageUrl, prefer_large_media: true, show_above_text: true } : { is_disabled: true },
    },
  };
}

export async function updateItemCardMessage(
  deps: CardDeps & { db: Database; messenger: Messenger; log: Logger },
  itemId: string,
  ref: BotMessageRef,
): Promise<void> {
  const card = await getBotItemCard(deps.db, itemId);
  if (!card) return;
  const message = card.deleted
    ? { text: itemDeletedByOwnerText(card), extra: { reply_markup: { inline_keyboard: [] } } }
    : renderItemCard(card, deps);
  const outcome = await deps.messenger.edit(ref.chatId, ref.messageId, message.text, message.extra);
  if (outcome !== "sent") deps.log("warn", "bot card not updated", { itemId, outcome });
}
```

Run: `pnpm vitest run apps/worker/src/bot/card.test.ts`
Expected: PASS (5 тестов). `applyParseResult` и `getBotItemCard` приходят из `@wishlist/db/testing` (реэкспорт `index`).

- [x] **Step 4: `/start` — тест (падает)**

`apps/worker/src/bot/start.test.ts`:
```ts
import { signReminderPayload } from "@wishlist/core";
import {
  addItem,
  createTestDb,
  createUserFixture,
  createWishlist,
  type Database,
  findUserIdByTelegram,
  reservations,
} from "@wishlist/db/testing";
import { eq } from "drizzle-orm";
import { beforeEach, expect, test } from "vitest";
import { ensureBotUser, startReply } from "./start";
import { START_TEXT } from "./texts";

const SECRET = "s".repeat(32);
const APP = "https://my-wish-list.online";
const OLYA = { id: 555001, first_name: "Оля", last_name: "Иванова" };

let db: Database;
let reservationId: string;

beforeEach(async () => {
  db = await createTestDb();
  const owner = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  const added = await addItem(db, owner, list.wishlist.id, { title: "Свеча", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  const [row] = await db
    .insert(reservations)
    .values({ itemId: added.itemId, guestToken: "tok", guestName: "Оля", cancelToken: "c1" })
    .returning({ id: reservations.id });
  reservationId = row!.id;
});

test("ensureBotUser creates the Telegram user once", async () => {
  const first = await ensureBotUser(db, OLYA);
  expect(await ensureBotUser(db, OLYA)).toBe(first);
  expect(await findUserIdByTelegram(db, OLYA.id)).toBe(first);
});

test("plain /start greets and offers to open the app", async () => {
  const reply = await startReply({ db, appUrl: APP, sessionSecret: SECRET }, OLYA, "");
  expect(reply.text).toBe(START_TEXT);
  expect(reply.extra.reply_markup?.inline_keyboard[0]?.[0]).toEqual({ text: "Открыть вишлист", web_app: { url: "https://my-wish-list.online/tg?next=%2Flists" } });
});

test("signed reminder link attaches the site reservation to the Telegram user", async () => {
  const reply = await startReply({ db, appUrl: APP, sessionSecret: SECRET }, OLYA, signReminderPayload(reservationId, SECRET));
  expect(reply.text).toBe("Готово! Напомню о подарке за 14, 7 и 2 дня до праздника.");
  const [row] = await db.select({ guestUserId: reservations.guestUserId }).from(reservations).where(eq(reservations.id, reservationId));
  expect(row?.guestUserId).toBe(await findUserIdByTelegram(db, OLYA.id));
});

test("forged reminder links change nothing", async () => {
  const reply = await startReply({ db, appUrl: APP, sessionSecret: SECRET }, OLYA, signReminderPayload(reservationId, "x".repeat(32)));
  expect(reply.text).toBe("Ссылка устарела. Откройте список и нажмите «Напомнить в Telegram» ещё раз.");
  const [row] = await db.select({ guestUserId: reservations.guestUserId }).from(reservations).where(eq(reservations.id, reservationId));
  expect(row?.guestUserId).toBeNull();
});
```

Run: `pnpm vitest run apps/worker/src/bot/start.test.ts`
Expected: FAIL — `Failed to resolve import "./start"`.

- [x] **Step 5: `/start` — реализация**

`apps/worker/src/bot/start.ts`:
```ts
import { verifyReminderPayload } from "@wishlist/core";
import { attachReservationToUser, type Database, upsertUserFromIdentity } from "@wishlist/db";
import type { SendExtra } from "../telegram/messenger";
import { openAppKeyboard } from "./keyboards";
import { attachResultText, START_TEXT } from "./texts";

export type TelegramFrom = { id: number; first_name: string; last_name?: string; username?: string };
export type BotReply = { text: string; extra: SendExtra };

// Тот же пользователь, что при входе в Mini App: identity telegram с тем же id
export async function ensureBotUser(db: Database, from: TelegramFrom): Promise<string> {
  const displayName = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const user = await upsertUserFromIdentity(db, { provider: "telegram", providerUserId: String(from.id), displayName, avatarUrl: null });
  return user.id;
}

export async function startReply(deps: { db: Database; appUrl: string; sessionSecret: string }, from: TelegramFrom, payload: string): Promise<BotReply> {
  const userId = await ensureBotUser(deps.db, from);
  const keyboard = { reply_markup: openAppKeyboard(deps.appUrl) };
  if (!payload.startsWith("r")) return { text: START_TEXT, extra: keyboard };
  const reservationId = verifyReminderPayload(payload, deps.sessionSecret);
  if (!reservationId) return { text: attachResultText("bad_link"), extra: keyboard };
  return { text: attachResultText(await attachReservationToUser(deps.db, reservationId, userId)), extra: keyboard };
}
```

Параметр `inline` (кнопка из inline-режима, Task 10) начинается не с `r`, поэтому даёт приветствие.

Run: `pnpm vitest run apps/worker/src/bot`
Expected: PASS.

- [x] **Step 6: Создание бота**

`apps/worker/src/bot/create-bot.ts`:
```ts
import type { NotifyJob, ParseItemJob } from "@wishlist/core";
import type { Database } from "@wishlist/db";
import { Bot } from "grammy";
import type { TelegramConfig } from "../env";
import type { Logger } from "../log";
import { startReply } from "./start";

export type BotDeps = {
  config: TelegramConfig;
  db: Database;
  log: Logger;
  imagesPublicBaseUrl: string | null;
  enqueueParse(job: ParseItemJob): Promise<void>;
  enqueueNotify(job: NotifyJob): Promise<void>;
};

export async function createTelegramBot(deps: BotDeps): Promise<Bot | null> {
  const bot = new Bot(deps.config.token);
  try {
    await bot.init();
  } catch (error) {
    // Локально токен фейковый: воркер должен работать и без бота
    deps.log("warn", "telegram bot token rejected", { error: String(error) });
    return null;
  }

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const reply = await startReply({ db: deps.db, appUrl: deps.config.appUrl, sessionSecret: deps.config.sessionSecret }, ctx.from, ctx.match);
    await ctx.reply(reply.text, { parse_mode: "HTML", ...reply.extra });
  });

  // Администратору: узнать свой id для ADMIN_TELEGRAM_ID
  bot.command("myid", async (ctx) => {
    if (ctx.from) await ctx.reply(`Ваш Telegram id: ${ctx.from.id}`);
  });

  bot.catch((error) => deps.log("error", "bot update failed", { updateId: error.ctx.update.update_id, error: String(error.error) }));

  await bot.api.setMyCommands([{ command: "start", description: "Открыть вишлист" }]);
  await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Вишлист", web_app: { url: new URL("/tg", deps.config.appUrl).toString() } } });
  return bot;
}
```

- [x] **Step 7: Регистрация задач**

`apps/worker/src/jobs.ts`:
```ts
import { type NotifyJob, type ParseItemJob, QUEUES } from "@wishlist/core";
import type { Database } from "@wishlist/db";
import { parseProduct, type SafeFetcher } from "@wishlist/parser";
import type { PgBoss } from "pg-boss";
import { updateItemCardMessage } from "./bot/card";
import type { S3Config, TelegramConfig } from "./env";
import type { Logger } from "./log";
import { MAINTENANCE_CRON, MAINTENANCE_TZ, runMaintenance } from "./maintenance";
import { runNotify } from "./notify";
import { runParseItem } from "./parse-item";
import type { ObjectStorage } from "./storage";
import type { Messenger } from "./telegram/messenger";

const PARSE_CONCURRENCY = 2;

export type JobDeps = {
  db: Database;
  databaseUrl: string;
  fetcher: SafeFetcher;
  waitTurn(url: string): Promise<void>;
  storage: ObjectStorage | null;
  s3: S3Config | null;
  telegram: TelegramConfig | null;
  imagesPublicBaseUrl: string | null;
  messenger: Messenger | null;
  log: Logger;
};

async function parseJob(job: ParseItemJob, deps: JobDeps): Promise<void> {
  await runParseItem(job.itemId, {
    db: deps.db,
    parse: (url) => parseProduct(url, { fetchPage: deps.fetcher.fetchPage, waitTurn: deps.waitTurn }),
    fetchImage: async (url) => {
      await deps.waitTurn(url);
      return deps.fetcher.fetchImage(url);
    },
    images: deps.storage && deps.s3 ? { storage: deps.storage, bucket: deps.s3.imagesBucket } : null,
    log: deps.log,
  });
  if (!job.botMessage || !deps.messenger || !deps.telegram) return;
  // Карточка в чате — удобство: ошибка редактирования не должна повторять парсинг
  await updateItemCardMessage(
    { db: deps.db, messenger: deps.messenger, appUrl: deps.telegram.appUrl, imagesPublicBaseUrl: deps.imagesPublicBaseUrl, log: deps.log },
    job.itemId,
    job.botMessage,
  ).catch((error: unknown) => deps.log("warn", "bot card update crashed", { itemId: job.itemId, error: String(error) }));
}

export async function registerJobs(boss: PgBoss, deps: JobDeps): Promise<void> {
  for (const name of Object.values(QUEUES)) await boss.createQueue(name);

  await boss.work<ParseItemJob>(QUEUES.parseItem, { localConcurrency: PARSE_CONCURRENCY }, async ([job]) => {
    if (!job) return;
    try {
      await parseJob(job.data, deps);
    } catch (error) {
      // pg-boss сам пометит задачу failed, но в лог контейнера ничего не попадёт
      deps.log("error", "parse job failed", { itemId: job.data.itemId, error: String(error) });
      throw error;
    }
  });

  await boss.work<NotifyJob>(QUEUES.notify, async ([job]) => {
    // Без бота уведомления некуда отправлять — задача просто завершается
    if (!job || !deps.messenger || !deps.telegram) return;
    try {
      await runNotify(job.data, { db: deps.db, messenger: deps.messenger, appUrl: deps.telegram.appUrl, now: () => new Date(), log: deps.log });
    } catch (error) {
      deps.log("warn", "notify job failed", { kind: job.data.kind, itemId: job.data.itemId, error: String(error) });
      throw error;
    }
  });

  const maintenanceDeps = { db: deps.db, databaseUrl: deps.databaseUrl, storage: deps.storage, backupsBucket: deps.s3?.backupsBucket ?? null, log: deps.log };
  await boss.work(QUEUES.maintenance, async () => {
    await runMaintenance(maintenanceDeps);
  });
  await boss.schedule(QUEUES.maintenance, MAINTENANCE_CRON, {}, { tz: MAINTENANCE_TZ });
}

export { PARSE_CONCURRENCY };
```

- [x] **Step 8: `main.ts`**

`apps/worker/src/main.ts` — заменить целиком:
```ts
import { NOTIFY_JOB_OPTIONS, PARSE_JOB_OPTIONS, QUEUES } from "@wishlist/core";
import { createDb } from "@wishlist/db";
import { createHostThrottle, createSafeFetcher } from "@wishlist/parser";
import { PgBoss } from "pg-boss";
import sharp from "sharp";
import { createTelegramBot } from "./bot/create-bot";
import { readWorkerEnv } from "./env";
import { PARSE_CONCURRENCY, registerJobs } from "./jobs";
import { log } from "./log";
import { runMaintenance } from "./maintenance";
import { createS3Storage } from "./storage";
import { createMessenger } from "./telegram/messenger";

const HOST_INTERVAL_MS = 2000;
const DB_POOL = 3;
const SHUTDOWN_TIMEOUT_MS = 20_000;

const env = readWorkerEnv();

// 200 МБ на контейнер: одна картинка за раз и без кэша libvips
sharp.cache(false);
sharp.concurrency(1);

const db = createDb(env.DATABASE_URL, { maxConnections: DB_POOL });
const fetcher = createSafeFetcher();
const waitTurn = createHostThrottle(HOST_INTERVAL_MS);
const storage = env.s3 ? createS3Storage(env.s3) : null;
if (!storage) log("warn", "S3 is not configured: photos and backups are disabled");

if (process.argv.includes("--maintenance-once")) {
  await runMaintenance({ db, databaseUrl: env.DATABASE_URL, storage, backupsBucket: env.s3?.backupsBucket ?? null, log });
  await fetcher.close();
  process.exit(0);
}

const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: DB_POOL });
boss.on("error", (error) => log("error", "pg-boss error", { error: String(error) }));
await boss.start();

const bot = env.telegram
  ? await createTelegramBot({
      config: env.telegram,
      db,
      log,
      imagesPublicBaseUrl: env.imagesPublicBaseUrl,
      enqueueParse: async (job) => void (await boss.send(QUEUES.parseItem, job, PARSE_JOB_OPTIONS)),
      enqueueNotify: async (job) => void (await boss.send(QUEUES.notify, job, NOTIFY_JOB_OPTIONS)),
    })
  : null;
if (!bot) log("warn", "Telegram bot is disabled: bot features and notifications are off");

await registerJobs(boss, {
  db,
  databaseUrl: env.DATABASE_URL,
  fetcher,
  waitTurn,
  storage,
  s3: env.s3,
  telegram: bot ? env.telegram : null,
  imagesPublicBaseUrl: env.imagesPublicBaseUrl,
  messenger: bot ? createMessenger(bot.api) : null,
  log,
});

// Очереди созданы — теперь можно принимать сообщения, которые ставят задачи
if (bot) {
  void bot
    .start({ allowed_updates: ["message", "callback_query", "inline_query"], onStart: () => log("info", "bot polling started") })
    .catch((error: unknown) => log("error", "bot polling stopped", { error: String(error) }));
}

log("info", "worker started", { parseConcurrency: PARSE_CONCURRENCY, s3: storage !== null, telegram: bot !== null });

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", "worker stopping", { signal });
  await bot?.stop();
  await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
  await fetcher.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

- [x] **Step 9: Проверка локально**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS.

Локальный запуск с фейковым токеном из `apps/web/.env.development.local` (терминалы: `pnpm dev:db`, затем `pnpm dev:worker`):
Expected в логе: `"telegram bot token rejected"` (warn), `"Telegram bot is disabled..."` (warn), `"worker started"` с `"telegram":false`; процесс не падает. Добавить подарок ссылкой в web (`pnpm dev:web`) → в логе воркера `item parsed`, ошибок нет. Остановить процессы (у `pnpm dev:worker` дочерний `node dist/main.mjs` может пережить остановку — проверить и завершить его).

- [x] **Step 10: Commit**

```bash
git add apps/worker
git commit -m "feat(worker): run the Telegram bot with /start, reminder links and card updates after parsing"
```
