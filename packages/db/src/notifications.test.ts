import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem } from "./items";
import {
  claimNotification,
  DAILY_NOTIFICATION_LIMIT,
  getActiveReservationNotice,
  getTelegramId,
  listDueReminders,
  listUnannouncedReservations,
  releaseNotification,
} from "./notifications";
import { authIdentities, notificationLog, reservations, users } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

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

async function reserve(item: string, guestUserId: string | null, cancelToken = `cancel-${Math.random()}`) {
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

test("the evening digest is not blocked by the daily limit, but goes out once a day", async () => {
  const claim = { userId: owner, kind: "owner_reserved" as const, refId: "r1" };
  await claimNotification(db, claim, TODAY);
  await claimNotification(db, { ...claim, refId: "r2" }, TODAY);
  const digest = { userId: owner, kind: "owner_digest" as const, refId: TODAY };
  expect(await claimNotification(db, digest, TODAY)).toBe(true);
  expect(await claimNotification(db, digest, TODAY)).toBe(false);
});

describe("listUnannouncedReservations", () => {
  const SINCE = new Date(Date.now() - 60 * 60 * 1000);

  async function item(title: string) {
    const added = await addItem(db, owner, listId, { title, sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!added.ok) throw new Error("setup");
    return added.itemId;
  }

  test("counts owner's active reservations the owner was not told about", async () => {
    const told = await reserve(itemId, null);
    await db.insert(notificationLog).values({ userId: owner, kind: "owner_reserved", refId: told, sentOn: TODAY });
    await reserve(await item("Свеча"), null);
    await reserve(await item("Шарф"), null);
    const cancelled = await reserve(await item("Книга"), null);
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, cancelled));
    const deletedItem = await item("Кружка");
    await reserve(deletedItem, null);
    await deleteItem(db, owner, deletedItem);
    expect(await listUnannouncedReservations(db, SINCE)).toEqual([{ ownerId: owner, count: 2 }]);
  });

  test("skips surprise mode and reservations before the window", async () => {
    await reserve(itemId, null);
    expect(await listUnannouncedReservations(db, new Date(Date.now() + 60 * 1000))).toEqual([]);
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    expect(await listUnannouncedReservations(db, SINCE)).toEqual([]);
  });
});
