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
  expect(reply.extra.reply_markup?.inline_keyboard[0]?.[0]).toEqual({
    text: "Открыть вишлист",
    web_app: { url: "https://my-wish-list.online/tg?next=%2Flists" },
  });
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
