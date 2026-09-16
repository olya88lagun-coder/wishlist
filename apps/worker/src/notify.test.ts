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
    expect(sent[1]!.extra?.reply_markup?.inline_keyboard.flat()).toContainEqual({
      text: "Снять бронь",
      callback_data: cancelReservationCallback(reservationId),
    });
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
