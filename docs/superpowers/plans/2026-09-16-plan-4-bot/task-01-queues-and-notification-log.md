# Task 1: Типы задач, журнал уведомлений, запросы уведомлений и напоминаний

**Files:**
- Modify: `packages/core/src/queues.ts`
- Modify: `packages/db/src/schema.ts`, `packages/db/src/public-view.ts` (экспорт `firstName`), `packages/db/src/index.ts`
- Create: `packages/db/drizzle/0002_*.sql` (генерирует drizzle-kit)
- Create: `packages/db/src/notifications.ts`
- Test: `packages/db/src/notifications.test.ts`

**Interfaces:**
- Consumes: `todayInTimeZone` из `@wishlist/core` (план 2); таблицы `users`, `auth_identities`, `wishlists`, `items`, `reservations`.
- Produces:
  ```ts
  // @wishlist/core
  const QUEUES: { parseItem: "parse-item"; maintenance: "maintenance"; notify: "notify"; reminders: "reminders"; canary: "canary"; uptime: "uptime" };
  type BotMessageRef = { chatId: number; messageId: number };
  type ParseItemJob = { itemId: string; botMessage?: BotMessageRef };
  type NotifyJob = { kind: "reservation_created"; itemId: string } | { kind: "item_deleted"; itemId: string };
  const NOTIFY_JOB_OPTIONS: { retryLimit: 3; retryDelay: 60; expireInSeconds: 60 };
  // @wishlist/db
  const DAILY_NOTIFICATION_LIMIT = 2;
  type NotificationKind = "owner_reserved" | "guest_reserved" | "item_deleted" | "reminder";
  type NotificationClaim = { userId: string; kind: NotificationKind; refId: string };
  function claimNotification(db: Database, claim: NotificationClaim, day: string): Promise<boolean>;
  function releaseNotification(db: Database, claim: NotificationClaim): Promise<void>;
  function getTelegramId(db: Database, userId: string): Promise<number | null>;
  type ReservationNotice = { reservationId: string; guestUserId: string | null; itemTitle: string; wishlistTitle: string; slug: string; occasion: WishlistOccasion; eventDate: string | null; ownerId: string; ownerName: string; surpriseMode: boolean };
  function getActiveReservationNotice(db: Database, itemId: string): Promise<ReservationNotice | null>;
  type DueReminder = { guestUserId: string; itemTitle: string; wishlistTitle: string; slug: string; occasion: WishlistOccasion; ownerName: string; daysLeft: number };
  function listDueReminders(db: Database, today: string, days: readonly number[]): Promise<DueReminder[]>;
  function firstName(displayName: string): string; // из public-view.ts, теперь экспортируется
  ```

- [ ] **Step 1: Ветка**

Ветка `feat/bot` создана вместе с планом.
```bash
git checkout feat/bot && git status --short
```
Expected: пусто (кроме неотслеживаемой `.claude/`).

- [ ] **Step 2: Типы очередей**

`packages/core/src/queues.ts` — заменить целиком:
```ts
// Общие для web (ставит задачи) и worker (выполняет)
export const QUEUES = {
  parseItem: "parse-item",
  maintenance: "maintenance",
  notify: "notify",
  reminders: "reminders",
  canary: "canary",
  uptime: "uptime",
} as const;

// Сообщение бота с карточкой подарка: после парсинга воркер его отредактирует
export type BotMessageRef = { chatId: number; messageId: number };

export type ParseItemJob = { itemId: string; botMessage?: BotMessageRef };

// В задачу кладём только id: тексты воркер собирает из базы, чтобы в очереди не лежали имена
export type NotifyJob = { kind: "reservation_created"; itemId: string } | { kind: "item_deleted"; itemId: string };

// Одна повторная попытка: если воркер упал посреди задачи, pg-boss вернёт её через 2 минуты
export const PARSE_JOB_OPTIONS = { retryLimit: 1, retryDelay: 30, expireInSeconds: 120 } as const;

// Telegram временно отвечает 429/5xx — три повтора с паузой в минуту
export const NOTIFY_JOB_OPTIONS = { retryLimit: 3, retryDelay: 60, expireInSeconds: 60 } as const;
```

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Таблица `notification_log`**

В `packages/db/src/schema.ts` в конец файла:
```ts
// Одно событие — одно сообщение человеку (уникальный индекс), и не больше дневного лимита (индекс по дню)
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    refId: text("ref_id").notNull(),
    sentOn: date("sent_on", { mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notification_log_once_uq").on(t.userId, t.kind, t.refId),
    index("notification_log_user_day_idx").on(t.userId, t.sentOn),
  ],
);
```

Run: `pnpm --filter @wishlist/db db:generate`
Expected: создан `packages/db/drizzle/0002_<слово>_<слово>.sql` с `CREATE TABLE "notification_log"`, двумя индексами и внешним ключом на `users`; в `drizzle/meta/_journal.json` запись `idx: 2`. Других изменений в SQL нет (если есть — схема разошлась с миграциями, остановиться и разобраться).

- [ ] **Step 4: Экспорт `firstName`**

В `packages/db/src/public-view.ts` заменить `function firstName(` на `export function firstName(`.

- [ ] **Step 5: Тест (падает)**

`packages/db/src/notifications.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem } from "./items";
import {
  claimNotification,
  DAILY_NOTIFICATION_LIMIT,
  getActiveReservationNotice,
  getTelegramId,
  listDueReminders,
  releaseNotification,
} from "./notifications";
import { authIdentities, reservations, users } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";
import { eq } from "drizzle-orm";

const TODAY = "2026-10-01";

let db: Database;
let owner: string;
let guest: string;
let listId: string;
let slug: string;
let itemId: string;

async function withTelegram(userId: string, telegramId: number) {
  await db.insert(authIdentities).values({ userId, provider: "telegram", providerUserId: String(telegramId) });
}

async function reserve(item: string, guestUserId: string | null, cancelToken = `cancel-${item}`) {
  const [row] = await db
    .insert(reservations)
    .values({ itemId: item, guestUserId, guestToken: guestUserId ? null : "tok", guestName: "Оля", cancelToken })
    .returning({ id: reservations.id });
  return row!.id;
}

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша Петрова");
  guest = await createUserFixture(db, "Оля");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: "2026-10-08" });
  if (!list.ok) throw new Error("setup");
  listId = list.wishlist.id;
  slug = list.wishlist.slug;
  const added = await addItem(db, owner, listId, { title: "Наушники", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

describe("claimNotification", () => {
  test("one event is claimed once and the daily limit caps different events", async () => {
    const claim = { userId: guest, kind: "guest_reserved" as const, refId: "r1" };
    expect(await claimNotification(db, claim, TODAY)).toBe(true);
    expect(await claimNotification(db, claim, TODAY)).toBe(false);
    expect(await claimNotification(db, { ...claim, refId: "r2" }, TODAY)).toBe(true);
    expect(DAILY_NOTIFICATION_LIMIT).toBe(2);
    expect(await claimNotification(db, { ...claim, refId: "r3" }, TODAY)).toBe(false);
    expect(await claimNotification(db, { ...claim, refId: "r3" }, "2026-10-02")).toBe(true);
  });

  test("released claim frees the slot for a retry", async () => {
    const claim = { userId: guest, kind: "reminder" as const, refId: TODAY };
    expect(await claimNotification(db, claim, TODAY)).toBe(true);
    await releaseNotification(db, claim);
    expect(await claimNotification(db, claim, TODAY)).toBe(true);
  });
});

test("getTelegramId returns the numeric Telegram id or null", async () => {
  await withTelegram(guest, 555001);
  expect(await getTelegramId(db, guest)).toBe(555001);
  expect(await getTelegramId(db, owner)).toBeNull();
});

describe("getActiveReservationNotice", () => {
  test("describes the active reservation, also after the item was deleted", async () => {
    const reservationId = await reserve(itemId, guest);
    const expected = {
      reservationId,
      guestUserId: guest,
      itemTitle: "Наушники",
      wishlistTitle: "Маше 30",
      slug,
      occasion: "birthday",
      eventDate: "2026-10-08",
      ownerId: owner,
      ownerName: "Маша",
      surpriseMode: false,
    };
    expect(await getActiveReservationNotice(db, itemId)).toEqual(expected);
    await deleteItem(db, owner, itemId);
    expect(await getActiveReservationNotice(db, itemId)).toEqual(expected);
  });

  test("returns null without an active reservation or for a malformed id", async () => {
    const reservationId = await reserve(itemId, guest);
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, reservationId));
    expect(await getActiveReservationNotice(db, itemId)).toBeNull();
    expect(await getActiveReservationNotice(db, "not-a-uuid")).toBeNull();
  });

  test("reports the owner's surprise mode", async () => {
    await reserve(itemId, null);
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    expect((await getActiveReservationNotice(db, itemId))?.surpriseMode).toBe(true);
  });
});

describe("listDueReminders", () => {
  test("finds Telegram guests whose event is exactly 14, 7 or 2 days away", async () => {
    await withTelegram(guest, 555001);
    await reserve(itemId, guest);
    expect(await listDueReminders(db, TODAY, [14, 7, 2])).toEqual([
      { guestUserId: guest, itemTitle: "Наушники", wishlistTitle: "Маше 30", slug, occasion: "birthday", ownerName: "Маша", daysLeft: 7 },
    ]);
    expect(await listDueReminders(db, "2026-10-02", [14, 7, 2])).toEqual([]);
  });

  test("skips guests without Telegram, deleted items and cancelled reservations", async () => {
    const siteGuestItem = await addItem(db, owner, listId, { title: "Свеча", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!siteGuestItem.ok) throw new Error("setup");
    await reserve(siteGuestItem.itemId, guest);
    expect(await listDueReminders(db, TODAY, [7])).toEqual([]);

    await withTelegram(guest, 555001);
    await deleteItem(db, owner, siteGuestItem.itemId);
    expect(await listDueReminders(db, TODAY, [7])).toEqual([]);

    const cancelled = await reserve(itemId, guest);
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, cancelled));
    expect(await listDueReminders(db, TODAY, [7])).toEqual([]);
  });
});
```

Run: `pnpm vitest run packages/db/src/notifications.test.ts`
Expected: FAIL — `Failed to resolve import "./notifications"`.

- [ ] **Step 6: Реализация**

`packages/db/src/notifications.ts`:
```ts
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { isUuid } from "./errors";
import { firstName } from "./public-view";
import { authIdentities, items, notificationLog, reservations, users, wishlists } from "./schema";
import type { Database } from "./types";
import type { WishlistOccasion } from "./wishlists";

export const DAILY_NOTIFICATION_LIMIT = 2;

export type NotificationKind = "owner_reserved" | "guest_reserved" | "item_deleted" | "reminder";
export type NotificationClaim = { userId: string; kind: NotificationKind; refId: string };

// Место в дневном лимите занимается до отправки; если Telegram не принял сообщение — releaseNotification
export async function claimNotification(db: Database, claim: NotificationClaim, day: string): Promise<boolean> {
  const [sent] = await db
    .select({ total: count() })
    .from(notificationLog)
    .where(and(eq(notificationLog.userId, claim.userId), eq(notificationLog.sentOn, day)));
  if ((sent?.total ?? 0) >= DAILY_NOTIFICATION_LIMIT) return false;
  const inserted = await db
    .insert(notificationLog)
    .values({ userId: claim.userId, kind: claim.kind, refId: claim.refId, sentOn: day })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  return inserted.length > 0;
}

export async function releaseNotification(db: Database, claim: NotificationClaim): Promise<void> {
  await db
    .delete(notificationLog)
    .where(and(eq(notificationLog.userId, claim.userId), eq(notificationLog.kind, claim.kind), eq(notificationLog.refId, claim.refId)));
}

export async function getTelegramId(db: Database, userId: string): Promise<number | null> {
  const [row] = await db
    .select({ providerUserId: authIdentities.providerUserId })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "telegram")))
    .limit(1);
  return row ? Number(row.providerUserId) : null;
}

export type ReservationNotice = {
  reservationId: string;
  guestUserId: string | null;
  itemTitle: string;
  wishlistTitle: string;
  slug: string;
  occasion: WishlistOccasion;
  eventDate: string | null;
  ownerId: string;
  ownerName: string;
  surpriseMode: boolean;
};

// Удалённые подарки тоже ищутся: уведомление об удалении строится уже после мягкого удаления
export async function getActiveReservationNotice(db: Database, itemId: string): Promise<ReservationNotice | null> {
  if (!isUuid(itemId)) return null;
  const [row] = await db
    .select({
      reservationId: reservations.id,
      guestUserId: reservations.guestUserId,
      itemTitle: items.title,
      wishlistTitle: wishlists.title,
      slug: wishlists.slug,
      occasion: wishlists.occasion,
      eventDate: wishlists.eventDate,
      ownerId: wishlists.ownerId,
      ownerDisplayName: users.displayName,
      surpriseMode: users.surpriseMode,
    })
    .from(reservations)
    .innerJoin(items, eq(items.id, reservations.itemId))
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .innerJoin(users, eq(users.id, wishlists.ownerId))
    .where(and(eq(reservations.itemId, itemId), eq(reservations.status, "active")));
  if (!row) return null;
  const { ownerDisplayName, ...notice } = row;
  return { ...notice, ownerName: firstName(ownerDisplayName) };
}

export type DueReminder = {
  guestUserId: string;
  itemTitle: string;
  wishlistTitle: string;
  slug: string;
  occasion: WishlistOccasion;
  ownerName: string;
  daysLeft: number;
};

export async function listDueReminders(db: Database, today: string, days: readonly number[]): Promise<DueReminder[]> {
  if (days.length === 0) return [];
  // date - date в Postgres — целое число дней
  const daysLeft = sql<number>`(${wishlists.eventDate} - ${today}::date)::int`;
  const rows = await db
    .select({
      guestUserId: reservations.guestUserId,
      itemTitle: items.title,
      wishlistTitle: wishlists.title,
      slug: wishlists.slug,
      occasion: wishlists.occasion,
      ownerDisplayName: users.displayName,
      daysLeft,
    })
    .from(reservations)
    .innerJoin(items, and(eq(items.id, reservations.itemId), isNull(items.deletedAt)))
    .innerJoin(wishlists, eq(wishlists.id, items.wishlistId))
    .innerJoin(users, eq(users.id, wishlists.ownerId))
    .innerJoin(authIdentities, and(eq(authIdentities.userId, reservations.guestUserId), eq(authIdentities.provider, "telegram")))
    .where(
      and(
        eq(reservations.status, "active"),
        sql`(${wishlists.eventDate} - ${today}::date) in (${sql.join(days.map((d) => sql`${d}`), sql`, `)})`,
      ),
    )
    .orderBy(asc(reservations.guestUserId), asc(wishlists.eventDate), asc(items.title));
  return rows.map(({ ownerDisplayName, guestUserId, ...rest }) => ({ ...rest, guestUserId: guestUserId!, ownerName: firstName(ownerDisplayName) }));
}
```

В `packages/db/src/index.ts` добавить строку:
```ts
export * from "./notifications";
```

- [ ] **Step 7: Тест проходит**

Run: `pnpm vitest run packages/db`
Expected: PASS (все тесты пакета, включая 8 новых). Если `daysLeft` приходит строкой — PGlite вернул `int` как число только с `::int`; проверить, что каст на месте.

- [ ] **Step 8: Проверка и commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add packages/core packages/db
git commit -m "feat(db): notification log with daily limit, reservation notices and due reminders"
```
