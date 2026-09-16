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
