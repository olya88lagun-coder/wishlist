# Task 8: Напоминания гостям за 14, 7 и 2 дня

**Files:**
- Create: `apps/worker/src/reminders.ts`
- Test: `apps/worker/src/reminders.test.ts`
- Modify: `apps/worker/src/jobs.ts`

**Interfaces:**
- Consumes: `listDueReminders`, `DueReminder` (Task 1); `deliverNotification`, `DeliveryDeps` (Task 4); `reminderText`, `publicListUrl` (Task 3); `todayInTimeZone`, `EVENT_TIME_ZONE`, `QUEUES.reminders` из core.
- Produces:
  ```ts
  const REMINDER_DAYS: readonly [14, 7, 2];
  const REMINDERS_CRON = "0 12 * * *";
  type ReminderDeps = DeliveryDeps & { appUrl: string };
  type ReminderStats = { guests: number; sent: number; skipped: number; failed: number };
  function runReminders(deps: ReminderDeps): Promise<ReminderStats>;
  ```

Все напоминания одного гостя за день — одно сообщение (`kind: "reminder"`, `refId` = дата), строки по возрастанию даты праздника. Повторный запуск в тот же день отправит только тем, кому не удалось отправить в прошлый раз. Задача не бросает исключение: иначе pg-boss повторил бы её целиком; неотправленные видны в логе `reminders processed`.

- [ ] **Step 1: Тест (падает)**

`apps/worker/src/reminders.test.ts`:
```ts
import { addItem, authIdentities, createTestDb, createUserFixture, createWishlist, type Database, reservations } from "@wishlist/db/testing";
import { beforeEach, expect, test } from "vitest";
import { REMINDER_DAYS, type ReminderDeps, runReminders } from "./reminders";
import type { Messenger, SendExtra, SendOutcome } from "./telegram/messenger";

const NOW = new Date("2026-10-01T09:00:00Z"); // 12:00 МСК
let db: Database;
let sent: { chatId: number; text: string; extra?: SendExtra }[];
let outcome: SendOutcome;

const messenger: Messenger = {
  send: async (chatId, text, extra) => {
    if (outcome === "sent") sent.push({ chatId, text, extra });
    return outcome;
  },
  edit: async () => "sent",
};

function deps(): ReminderDeps {
  return { db, messenger, appUrl: "https://my-wish-list.online", now: () => NOW, log: () => undefined };
}

async function listWithReservedItem(ownerName: string, eventDate: string, itemTitle: string, guestUserId: string) {
  const owner = await createUserFixture(db, ownerName);
  const list = await createWishlist(db, owner, { title: `Список ${ownerName}`, occasion: "birthday", eventDate });
  if (!list.ok) throw new Error("setup");
  const added = await addItem(db, owner, list.wishlist.id, { title: itemTitle, sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  await db.insert(reservations).values({ itemId: added.itemId, guestUserId, guestName: "Оля", cancelToken: `c-${itemTitle}` });
}

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
  outcome = "sent";
});

test("reminder days are 14, 7 and 2", () => {
  expect(REMINDER_DAYS).toEqual([14, 7, 2]);
});

test("one merged message per guest, sent once a day", async () => {
  const olya = await createUserFixture(db, "Оля");
  const petya = await createUserFixture(db, "Петя");
  await db.insert(authIdentities).values([
    { userId: olya, provider: "telegram", providerUserId: "201" },
    { userId: petya, provider: "telegram", providerUserId: "202" },
  ]);
  await listWithReservedItem("Маша", "2026-10-08", "Свеча", olya);
  await listWithReservedItem("Катя", "2026-10-03", "Шарф", olya);
  await listWithReservedItem("Дима", "2026-10-15", "Книга", petya);
  await listWithReservedItem("Лена", "2026-10-05", "Кружка", petya);

  expect(await runReminders(deps())).toEqual({ guests: 2, sent: 2, skipped: 0, failed: 0 });
  const olyaMessage = sent.find((m) => m.chatId === 201)!;
  expect(olyaMessage.text).toBe("Напоминание о подарках 🎁\n• ДР через 2 дня у Катя — вы дарите «Шарф»\n• ДР через 7 дней у Маша — вы дарите «Свеча»");
  expect(olyaMessage.extra?.reply_markup?.inline_keyboard[0]?.[0]).toMatchObject({ text: "Открыть список" });
  expect(sent.find((m) => m.chatId === 202)!.text).toBe("Напоминание о подарках 🎁\n• ДР через 14 дней у Дима — вы дарите «Книга»");

  expect(await runReminders(deps())).toEqual({ guests: 2, sent: 0, skipped: 2, failed: 0 });
  expect(sent).toHaveLength(2);
});

test("temporary failures are counted and can be sent by a rerun the same day", async () => {
  const olya = await createUserFixture(db, "Оля");
  await db.insert(authIdentities).values({ userId: olya, provider: "telegram", providerUserId: "201" });
  await listWithReservedItem("Маша", "2026-10-08", "Свеча", olya);
  outcome = "failed";
  expect(await runReminders(deps())).toEqual({ guests: 1, sent: 0, skipped: 0, failed: 1 });
  outcome = "sent";
  expect(await runReminders(deps())).toEqual({ guests: 1, sent: 1, skipped: 0, failed: 0 });
});
```

Run: `pnpm vitest run apps/worker/src/reminders.test.ts`
Expected: FAIL — `Failed to resolve import "./reminders"`.

- [ ] **Step 2: Реализация**

`apps/worker/src/reminders.ts`:
```ts
import { todayInTimeZone } from "@wishlist/core";
import { type DueReminder, listDueReminders } from "@wishlist/db";
import { publicListUrl, reminderText } from "./bot/texts";
import { type DeliveryDeps, deliverNotification } from "./delivery";

export const REMINDER_DAYS = [14, 7, 2] as const;
export const REMINDERS_CRON = "0 12 * * *";

export type ReminderDeps = DeliveryDeps & { appUrl: string };
export type ReminderStats = { guests: number; sent: number; skipped: number; failed: number };

function groupByGuest(reminders: readonly DueReminder[]): Map<string, DueReminder[]> {
  const groups = new Map<string, DueReminder[]>();
  for (const reminder of reminders) groups.set(reminder.guestUserId, [...(groups.get(reminder.guestUserId) ?? []), reminder]);
  return groups;
}

// Задача не бросает: иначе pg-boss повторил бы её целиком. Неотправленные видны в статистике и логе,
// а их место в лимите освобождено — повторный запуск в тот же день дошлёт только их.
export async function runReminders(deps: ReminderDeps): Promise<ReminderStats> {
  const today = todayInTimeZone(deps.now());
  const groups = groupByGuest(await listDueReminders(deps.db, today, REMINDER_DAYS));
  const stats: ReminderStats = { guests: groups.size, sent: 0, skipped: 0, failed: 0 };
  for (const [guestUserId, reminders] of groups) {
    const extra = { reply_markup: { inline_keyboard: [[{ text: "Открыть список", url: publicListUrl(deps.appUrl, reminders[0]!.slug) }]] } };
    const outcome = await deliverNotification(deps, { userId: guestUserId, kind: "reminder", refId: today }, reminderText(reminders), extra);
    if (outcome === "sent") stats.sent += 1;
    else if (outcome === "failed") stats.failed += 1;
    else stats.skipped += 1;
  }
  deps.log("info", "reminders processed", { day: today, ...stats });
  return stats;
}
```

Run: `pnpm vitest run apps/worker/src/reminders.test.ts`
Expected: PASS (3 теста). Ответ `rejected` (гость не запускал бота) считается в `skipped`.

- [ ] **Step 3: Расписание**

В `apps/worker/src/jobs.ts` импорт:
```ts
import { REMINDERS_CRON, runReminders } from "./reminders";
```
и в конец `registerJobs` добавить:
```ts
  await boss.work(QUEUES.reminders, async () => {
    if (!deps.messenger || !deps.telegram) return;
    await runReminders({ db: deps.db, messenger: deps.messenger, appUrl: deps.telegram.appUrl, now: () => new Date(), log: deps.log });
  });
  await boss.schedule(QUEUES.reminders, REMINDERS_CRON, {}, { tz: MAINTENANCE_TZ });
```
(`MAINTENANCE_TZ` = `Europe/Moscow`, уже импортирован.)

- [ ] **Step 4: Проверка и commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @wishlist/worker build`
Expected: PASS.

```bash
git add apps/worker
git commit -m "feat(worker): daily merged gift reminders 14, 7 and 2 days before the event"
```
