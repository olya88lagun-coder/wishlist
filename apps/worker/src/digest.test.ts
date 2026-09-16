import { addItem, authIdentities, createTestDb, createUserFixture, createWishlist, type Database, reservations } from "@wishlist/db/testing";
import { beforeEach, expect, test } from "vitest";
import { OWNER_DIGEST_CRON, runOwnerDigest } from "./digest";
import type { Messenger, SendExtra } from "./telegram/messenger";

// Брони создаются с текущим временем — сводка запускается «сейчас»
const NOW = new Date();
let db: Database;
let sent: { chatId: number; text: string; extra?: SendExtra }[];

const messenger: Messenger = {
  send: async (chatId, text, extra) => {
    sent.push({ chatId, text, extra });
    return "sent";
  },
  edit: async () => "sent",
};

const deps = () => ({ db, messenger, now: () => NOW, log: () => undefined });

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
});

async function ownerWithReservations(telegramId: number, reserved: number) {
  const owner = await createUserFixture(db, "Маша");
  await db.insert(authIdentities).values({ userId: owner, provider: "telegram", providerUserId: String(telegramId) });
  const list = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("setup");
  for (let i = 0; i < reserved; i += 1) {
    const added = await addItem(db, owner, list.wishlist.id, { title: `Подарок ${i}`, sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!added.ok) throw new Error("setup");
    await db.insert(reservations).values({ itemId: added.itemId, guestToken: `t${i}`, guestName: "Оля", cancelToken: `c${telegramId}-${i}` });
  }
}

test("the digest goes out at 21:00 Moscow time", () => {
  expect(OWNER_DIGEST_CRON).toBe("0 21 * * *");
});

test("owners hear once about reservations the daily limit held back, without names", async () => {
  await ownerWithReservations(701, 3);
  await ownerWithReservations(702, 0);
  await runOwnerDigest(deps());
  await runOwnerDigest(deps());
  expect(sent).toHaveLength(1);
  expect(sent[0]!.chatId).toBe(701);
  expect(sent[0]!.text).toBe("🎁 Сегодня в ваших списках забронировали ещё 3 подарка. Кто и что — не скажем: пусть будет сюрприз.");
});
