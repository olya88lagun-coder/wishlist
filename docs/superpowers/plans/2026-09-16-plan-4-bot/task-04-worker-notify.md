# Task 4: Окружение воркера, отправка в Telegram, задача `notify`

**Files:**
- Modify: `apps/worker/package.json` (зависимость `grammy`), `pnpm-lock.yaml`
- Modify: `apps/worker/src/env.ts`
- Test: `apps/worker/src/env.test.ts` (переписать ожидания)
- Create: `apps/worker/src/telegram/messenger.ts`, `apps/worker/src/delivery.ts`, `apps/worker/src/notify.ts`
- Test: `apps/worker/src/telegram/messenger.test.ts`, `apps/worker/src/notify.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `claimNotification`, `releaseNotification`, `getTelegramId`, `getActiveReservationNotice` (Task 1); тексты `ownerReservedText`, `guestReservedText`, `itemDeletedText`, `publicListUrl` (Task 3); `NotifyJob`, `todayInTimeZone` из core.
- Produces:
  ```ts
  // env.ts
  type TelegramConfig = { token: string; appUrl: string; sessionSecret: string; adminId: number | null };
  type WorkerEnv = { DATABASE_URL: string; s3: S3Config | null; telegram: TelegramConfig | null; imagesPublicBaseUrl: string | null };
  // telegram/messenger.ts
  type SendExtra = { reply_markup?: InlineKeyboardMarkup; link_preview_options?: LinkPreviewOptions };
  type SendOutcome = "sent" | "rejected" | "failed";
  type Messenger = {
    send(chatId: number, text: string, extra?: SendExtra): Promise<SendOutcome>;
    edit(chatId: number, messageId: number, text: string, extra?: SendExtra): Promise<SendOutcome>;
  };
  function outcomeOf(error: unknown): SendOutcome;
  function createMessenger(api: Api): Messenger;
  // delivery.ts
  type DeliveryDeps = { db: Database; messenger: Messenger; now: () => Date; log: Logger };
  type DeliveryOutcome = SendOutcome | "no_telegram" | "skipped";
  function deliverNotification(deps: DeliveryDeps, claim: NotificationClaim, text: string, extra?: SendExtra): Promise<DeliveryOutcome>;
  // notify.ts
  type NotifyDeps = DeliveryDeps & { appUrl: string };
  function cancelReservationCallback(reservationId: string): string; // "cx:<id>"
  function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void>;   // бросает, если Telegram временно недоступен
  ```

- [x] **Step 1: Зависимость**

Run: `pnpm --filter @wishlist/worker add grammy@1.46.0 && pnpm --filter @wishlist/worker add -D drizzle-orm@0.45.2`
Expected: в `apps/worker/package.json` появились `"grammy": "1.46.0"` и в `devDependencies` `"drizzle-orm": "0.45.2"` (та же версия, что в `packages/db`; тестам воркера нужен `eq` для проверок в базе). Без `^`: если pnpm поставил `^` — исправить руками и `pnpm install`. Lock обновлён без ошибок `minimumReleaseAge`.

- [x] **Step 2: Окружение — тест (падает)**

`apps/worker/src/env.test.ts` — заменить целиком:
```ts
import { describe, expect, test } from "vitest";
import { readWorkerEnv } from "./env";

const DB = { DATABASE_URL: "postgres://wishlist:secret@db:5432/wishlist" };
const S3 = { S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret", S3_IMAGES_BUCKET: "wishlist-images", S3_BACKUPS_BUCKET: "wishlist-backups" };
const TG = { TELEGRAM_BOT_TOKEN: "123456:ABC-def_1", APP_URL: "https://my-wish-list.online", SESSION_SECRET: "s".repeat(32) };

describe("readWorkerEnv", () => {
  test("S3 with Timeweb defaults", () => {
    expect(readWorkerEnv({ ...DB, ...S3, S3_PUBLIC_BASE_URL: "https://s3.twcstorage.ru/wishlist-images" })).toEqual({
      DATABASE_URL: DB.DATABASE_URL,
      s3: { endpoint: "https://s3.twcstorage.ru", region: "ru-1", accessKeyId: "key", secretAccessKey: "secret", imagesBucket: "wishlist-images", backupsBucket: "wishlist-backups" },
      telegram: null,
      imagesPublicBaseUrl: "https://s3.twcstorage.ru/wishlist-images",
    });
  });

  test("no S3 and no bot token disable photos, backups and the bot", () => {
    expect(readWorkerEnv(DB)).toEqual({ DATABASE_URL: DB.DATABASE_URL, s3: null, telegram: null, imagesPublicBaseUrl: null });
  });

  test("bot token enables Telegram with an optional admin", () => {
    expect(readWorkerEnv({ ...DB, ...TG }).telegram).toEqual({ token: TG.TELEGRAM_BOT_TOKEN, appUrl: TG.APP_URL, sessionSecret: TG.SESSION_SECRET, adminId: null });
    expect(readWorkerEnv({ ...DB, ...TG, ADMIN_TELEGRAM_ID: "555001" }).telegram?.adminId).toBe(555001);
  });

  test("half-configured S3 or bot and missing database are errors that do not echo secrets", () => {
    expect(() => readWorkerEnv({ ...DB, S3_ACCESS_KEY_ID: "key" })).toThrow("S3_SECRET_ACCESS_KEY, S3_IMAGES_BUCKET, S3_BACKUPS_BUCKET");
    expect(() => readWorkerEnv({ ...S3 })).toThrow(/DATABASE_URL/);
    expect(() => readWorkerEnv({ ...DB, S3_ACCESS_KEY_ID: "key" })).not.toThrow(/key\b/);
    expect(() => readWorkerEnv({ ...DB, TELEGRAM_BOT_TOKEN: TG.TELEGRAM_BOT_TOKEN })).toThrow("Incomplete Telegram configuration, missing: APP_URL, SESSION_SECRET");
    expect(() => readWorkerEnv({ ...DB, TELEGRAM_BOT_TOKEN: TG.TELEGRAM_BOT_TOKEN })).not.toThrow(/ABC/);
  });
});
```

Run: `pnpm vitest run apps/worker/src/env.test.ts`
Expected: FAIL — в результате нет `telegram` и `imagesPublicBaseUrl`.

- [x] **Step 3: Окружение — реализация**

`apps/worker/src/env.ts` — заменить целиком:
```ts
import { z } from "zod";

const S3_REQUIRED = ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_IMAGES_BUCKET", "S3_BACKUPS_BUCKET"] as const;
const TELEGRAM_REQUIRED = ["APP_URL", "SESSION_SECRET"] as const;

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url().default("https://s3.twcstorage.ru"),
  S3_REGION: z.string().min(1).default("ru-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_IMAGES_BUCKET: z.string().min(1).optional(),
  S3_BACKUPS_BUCKET: z.string().min(1).optional(),
  S3_PUBLIC_BASE_URL: z.url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/).optional(),
  APP_URL: z.url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_TELEGRAM_ID: z.string().regex(/^\d+$/).optional(),
});

type ParsedEnv = z.infer<typeof schema>;

export type S3Config = { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; imagesBucket: string; backupsBucket: string };
export type TelegramConfig = { token: string; appUrl: string; sessionSecret: string; adminId: number | null };

export type WorkerEnv = {
  DATABASE_URL: string;
  s3: S3Config | null;
  telegram: TelegramConfig | null;
  imagesPublicBaseUrl: string | null;
};

function readS3(env: ParsedEnv): S3Config | null {
  const missing = S3_REQUIRED.filter((name) => !env[name]);
  if (missing.length === S3_REQUIRED.length) return null;
  if (missing.length > 0) throw new Error(`Incomplete S3 configuration, missing: ${missing.join(", ")}`);
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID!,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    imagesBucket: env.S3_IMAGES_BUCKET!,
    backupsBucket: env.S3_BACKUPS_BUCKET!,
  };
}

// Без токена бот выключен; токен без адреса сайта и секрета — ошибка конфигурации
function readTelegram(env: ParsedEnv): TelegramConfig | null {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const missing = TELEGRAM_REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Incomplete Telegram configuration, missing: ${missing.join(", ")}`);
  return {
    token: env.TELEGRAM_BOT_TOKEN,
    appUrl: env.APP_URL!,
    sessionSecret: env.SESSION_SECRET!,
    adminId: env.ADMIN_TELEGRAM_ID ? Number(env.ADMIN_TELEGRAM_ID) : null,
  };
}

export function readWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid environment variables: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  const env = parsed.data;
  return { DATABASE_URL: env.DATABASE_URL, s3: readS3(env), telegram: readTelegram(env), imagesPublicBaseUrl: env.S3_PUBLIC_BASE_URL ?? null };
}
```

Run: `pnpm vitest run apps/worker/src/env.test.ts`
Expected: PASS (4 теста).

- [x] **Step 4: Отправка — тест (падает)**

`apps/worker/src/telegram/messenger.test.ts`:
```ts
import { GrammyError, HttpError } from "grammy";
import { expect, test } from "vitest";
import { outcomeOf } from "./messenger";

function apiError(code: number, description: string) {
  return new GrammyError(`Call failed (${code}: ${description})`, { ok: false, error_code: code, description }, "sendMessage", {});
}

test("permanent Telegram refusals are not retried", () => {
  expect(outcomeOf(apiError(403, "Forbidden: bot was blocked by the user"))).toBe("rejected");
  expect(outcomeOf(apiError(400, "Bad Request: chat not found"))).toBe("rejected");
});

test("editing to the same content counts as success", () => {
  expect(outcomeOf(apiError(400, "Bad Request: message is not modified: specified new message content and reply markup are exactly the same"))).toBe("sent");
});

test("rate limits, server and network errors are temporary", () => {
  expect(outcomeOf(apiError(429, "Too Many Requests: retry after 5"))).toBe("failed");
  expect(outcomeOf(apiError(502, "Bad Gateway"))).toBe("failed");
  expect(outcomeOf(new HttpError("Network request for 'sendMessage' failed!", new Error("ECONNRESET")))).toBe("failed");
});
```

Run: `pnpm vitest run apps/worker/src/telegram`
Expected: FAIL — `Failed to resolve import "./messenger"`.

- [x] **Step 5: Отправка — реализация**

`apps/worker/src/telegram/messenger.ts`:
```ts
import { type Api, GrammyError } from "grammy";
import type { InlineKeyboardMarkup, LinkPreviewOptions } from "grammy/types";

export type SendExtra = { reply_markup?: InlineKeyboardMarkup; link_preview_options?: LinkPreviewOptions };
export type SendOutcome = "sent" | "rejected" | "failed";

export type Messenger = {
  send(chatId: number, text: string, extra?: SendExtra): Promise<SendOutcome>;
  edit(chatId: number, messageId: number, text: string, extra?: SendExtra): Promise<SendOutcome>;
};

const NOT_MODIFIED = /message is not modified/i;

// 403 — пользователь не запускал бота или заблокировал его; 400 — чат или сообщение не найдены. Повтор не поможет.
export function outcomeOf(error: unknown): SendOutcome {
  if (error instanceof GrammyError) {
    if (error.error_code === 400 && NOT_MODIFIED.test(error.description)) return "sent";
    if (error.error_code === 400 || error.error_code === 403) return "rejected";
  }
  return "failed";
}

export function createMessenger(api: Api): Messenger {
  return {
    async send(chatId, text, extra = {}) {
      try {
        await api.sendMessage(chatId, text, { parse_mode: "HTML", ...extra });
        return "sent";
      } catch (error) {
        return outcomeOf(error);
      }
    },
    async edit(chatId, messageId, text, extra = {}) {
      try {
        await api.editMessageText(chatId, messageId, text, { parse_mode: "HTML", ...extra });
        return "sent";
      } catch (error) {
        return outcomeOf(error);
      }
    },
  };
}
```

Run: `pnpm vitest run apps/worker/src/telegram`
Expected: PASS (3 теста). Если конструктор `GrammyError` в 1.46.0 принимает другие аргументы — посмотреть `node_modules/grammy/out/core/error.d.ts` и поправить только фабрику `apiError` в тесте.

- [x] **Step 6: Задача `notify` — тест (падает)**

`apps/worker/src/notify.test.ts`:
```ts
import {
  addItem,
  authIdentities,
  createTestDb,
  createUserFixture,
  createWishlist,
  type Database,
  deleteItem,
  reservations,
  users,
} from "@wishlist/db/testing";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { cancelReservationCallback, type NotifyDeps, runNotify } from "./notify";
import type { Messenger, SendExtra, SendOutcome } from "./telegram/messenger";

const OWNER_TG = 100;
const GUEST_TG = 200;
const NOW = new Date("2026-10-01T09:00:00Z");

let db: Database;
let owner: string;
let guest: string;
let itemId: string;
let reservationId: string;
let sent: { chatId: number; text: string; extra?: SendExtra }[];
let nextOutcome: SendOutcome;

function fakeMessenger(): Messenger {
  return {
    send: async (chatId, text, extra) => {
      if (nextOutcome === "sent") sent.push({ chatId, text, extra });
      return nextOutcome;
    },
    edit: async () => "sent",
  };
}

function deps(): NotifyDeps {
  return { db, messenger: fakeMessenger(), appUrl: "https://my-wish-list.online", now: () => NOW, log: () => undefined };
}

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
  nextOutcome = "sent";
  owner = await createUserFixture(db, "Маша");
  guest = await createUserFixture(db, "Оля");
  await db.insert(authIdentities).values([
    { userId: owner, provider: "telegram", providerUserId: String(OWNER_TG) },
    { userId: guest, provider: "telegram", providerUserId: String(GUEST_TG) },
  ]);
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: "2026-10-08" });
  if (!list.ok) throw new Error("setup");
  const added = await addItem(db, owner, list.wishlist.id, { title: "Свеча", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
  const [row] = await db
    .insert(reservations)
    .values({ itemId, guestUserId: guest, guestName: "Оля", cancelToken: "c1" })
    .returning({ id: reservations.id });
  reservationId = row!.id;
});

describe("reservation_created", () => {
  test("owner gets an anonymous notice and the guest gets a confirmation with a cancel button", async () => {
    await runNotify({ kind: "reservation_created", itemId }, deps());
    expect(sent.map((m) => m.chatId)).toEqual([OWNER_TG, GUEST_TG]);
    expect(sent[0]!.text).not.toContain("Оля");
    expect(sent[1]!.text).toContain("Вы дарите «Свеча»");
    expect(sent[1]!.extra?.reply_markup?.inline_keyboard.flat()).toContainEqual({ text: "Снять бронь", callback_data: cancelReservationCallback(reservationId) });
  });

  test("a retried job does not send twice", async () => {
    await runNotify({ kind: "reservation_created", itemId }, deps());
    await runNotify({ kind: "reservation_created", itemId }, deps());
    expect(sent).toHaveLength(2);
  });

  test("surprise mode keeps the owner uninformed; site guests get nothing", async () => {
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    await db.update(reservations).set({ guestUserId: null, guestToken: "tok" }).where(eq(reservations.id, reservationId));
    await runNotify({ kind: "reservation_created", itemId }, deps());
    expect(sent).toEqual([]);
  });

  test("temporary Telegram failure frees the slot and throws for a retry", async () => {
    nextOutcome = "failed";
    await expect(runNotify({ kind: "reservation_created", itemId }, deps())).rejects.toThrow("telegram send failed");
    nextOutcome = "sent";
    await runNotify({ kind: "reservation_created", itemId }, deps());
    expect(sent).toHaveLength(2);
  });

  test("permanent refusal is not retried", async () => {
    nextOutcome = "rejected";
    await expect(runNotify({ kind: "reservation_created", itemId }, deps())).resolves.toBeUndefined();
  });
});

test("item_deleted tells only the guest", async () => {
  await deleteItem(db, owner, itemId);
  await runNotify({ kind: "item_deleted", itemId }, deps());
  expect(sent).toHaveLength(1);
  expect(sent[0]!.chatId).toBe(GUEST_TG);
  expect(sent[0]!.text).toContain("удалил(а) «Свеча»");
});

test("nothing to do when the reservation is gone", async () => {
  await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, reservationId));
  await runNotify({ kind: "reservation_created", itemId }, deps());
  expect(sent).toEqual([]);
});
```

Run: `pnpm vitest run apps/worker/src/notify.test.ts`
Expected: FAIL — `Failed to resolve import "./notify"`.

`@wishlist/db/testing` реэкспортирует `index` (таблицы `authIdentities`, `reservations`, `users` — из `schema`), поэтому отдельный импорт схемы не нужен.

- [x] **Step 7: Доставка и `notify` — реализация**

`apps/worker/src/delivery.ts`:
```ts
import { todayInTimeZone } from "@wishlist/core";
import { claimNotification, type Database, getTelegramId, type NotificationClaim, releaseNotification } from "@wishlist/db";
import type { Logger } from "./log";
import type { Messenger, SendExtra, SendOutcome } from "./telegram/messenger";

export type DeliveryDeps = { db: Database; messenger: Messenger; now: () => Date; log: Logger };
export type DeliveryOutcome = SendOutcome | "no_telegram" | "skipped";

// Порядок: есть Telegram → место в дневном лимите → отправка. Временную ошибку откатываем, чтобы повтор смог отправить.
export async function deliverNotification(deps: DeliveryDeps, claim: NotificationClaim, text: string, extra: SendExtra = {}): Promise<DeliveryOutcome> {
  const telegramId = await getTelegramId(deps.db, claim.userId);
  if (telegramId === null) return "no_telegram";
  if (!(await claimNotification(deps.db, claim, todayInTimeZone(deps.now())))) {
    deps.log("info", "notification skipped", { kind: claim.kind, refId: claim.refId, reason: "duplicate_or_daily_limit" });
    return "skipped";
  }
  const outcome = await deps.messenger.send(telegramId, text, extra);
  if (outcome === "rejected") deps.log("warn", "notification rejected by telegram", { kind: claim.kind, refId: claim.refId });
  if (outcome === "failed") await releaseNotification(deps.db, claim);
  return outcome;
}
```

`apps/worker/src/notify.ts`:
```ts
import type { NotifyJob } from "@wishlist/core";
import { getActiveReservationNotice, type ReservationNotice } from "@wishlist/db";
import { guestReservedText, itemDeletedText, ownerReservedText, publicListUrl } from "./bot/texts";
import { type DeliveryDeps, type DeliveryOutcome, deliverNotification } from "./delivery";
import type { SendExtra } from "./telegram/messenger";

export type NotifyDeps = DeliveryDeps & { appUrl: string };

export function cancelReservationCallback(reservationId: string): string {
  return `cx:${reservationId}`;
}

function openListButton(appUrl: string, notice: ReservationNotice) {
  return { text: "Открыть список", url: publicListUrl(appUrl, notice.slug) };
}

function assertDelivered(outcome: DeliveryOutcome, kind: string): void {
  if (outcome === "failed") throw new Error(`telegram send failed: ${kind}`);
}

export async function runNotify(job: NotifyJob, deps: NotifyDeps): Promise<void> {
  const notice = await getActiveReservationNotice(deps.db, job.itemId);
  if (!notice) return;
  const openList: SendExtra = { reply_markup: { inline_keyboard: [[openListButton(deps.appUrl, notice)]] } };

  if (job.kind === "item_deleted") {
    if (!notice.guestUserId) return;
    const claim = { userId: notice.guestUserId, kind: "item_deleted" as const, refId: notice.reservationId };
    assertDelivered(await deliverNotification(deps, claim, itemDeletedText(notice), openList), claim.kind);
    return;
  }

  // Приватность: владелец узнаёт только сам факт брони, и не узнаёт ничего в режиме «Полный сюрприз»
  if (!notice.surpriseMode) {
    const claim = { userId: notice.ownerId, kind: "owner_reserved" as const, refId: notice.reservationId };
    assertDelivered(await deliverNotification(deps, claim, ownerReservedText(notice)), claim.kind);
  }
  if (notice.guestUserId) {
    const claim = { userId: notice.guestUserId, kind: "guest_reserved" as const, refId: notice.reservationId };
    const extra: SendExtra = {
      reply_markup: {
        inline_keyboard: [[openListButton(deps.appUrl, notice)], [{ text: "Снять бронь", callback_data: cancelReservationCallback(notice.reservationId) }]],
      },
    };
    assertDelivered(await deliverNotification(deps, claim, guestReservedText(notice, deps.now()), extra), claim.kind);
  }
}
```

- [x] **Step 8: Тесты проходят**

Run: `pnpm vitest run apps/worker`
Expected: PASS.

- [x] **Step 9: `.env.example`**

Добавить в `.env.example` после `TELEGRAM_BOT_USERNAME`:
```
# Telegram id администратора: алерты canary и проверки сайта (узнать — команда /myid боту)
ADMIN_TELEGRAM_ID=
```

- [x] **Step 10: Проверка и commit**

Run: `pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS; `dist/main.mjs` собран (grammY попадает в бандл).

```bash
git add apps/worker pnpm-lock.yaml .env.example
git commit -m "feat(worker): Telegram delivery with daily limit and notify job for reservations"
```
