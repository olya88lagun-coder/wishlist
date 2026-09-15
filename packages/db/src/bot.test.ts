import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { attachReservationToUser, cancelReservationForUser, findUserIdByTelegram, getBotItemCard, moveItem } from "./bot";
import { addItem, deleteItem } from "./items";
import { MAX_ITEMS_PER_WISHLIST } from "./limits";
import { authIdentities, items, reservations } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

const WB = "https://www.wildberries.ru/catalog/173937886/detail.aspx";

let db: Database;
let owner: string;
let stranger: string;
let firstList: string;
let secondList: string;
let itemId: string;

async function reservationFor(guestUserId: string | null) {
  const [row] = await db
    .insert(reservations)
    .values({ itemId, guestUserId, guestToken: guestUserId ? null : "tok", guestName: "Оля", cancelToken: `c-${Math.random()}` })
    .returning({ id: reservations.id });
  return row!.id;
}

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Оля");
  const a = await createWishlist(db, owner, { title: "ДР", occasion: "birthday", eventDate: null });
  const b = await createWishlist(db, owner, { title: "Новый год", occasion: "new_year", eventDate: null });
  if (!a.ok || !b.ok) throw new Error("setup");
  firstList = a.wishlist.id;
  secondList = b.wishlist.id;
  const added = await addItem(db, owner, firstList, { title: "", sourceUrl: WB, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

test("findUserIdByTelegram maps a Telegram id to the user", async () => {
  await db.insert(authIdentities).values({ userId: owner, provider: "telegram", providerUserId: "777" });
  expect(await findUserIdByTelegram(db, 777)).toBe(owner);
  expect(await findUserIdByTelegram(db, 778)).toBeNull();
});

describe("getBotItemCard", () => {
  test("returns what the card message needs, including the owner and deletion", async () => {
    expect(await getBotItemCard(db, itemId)).toEqual({
      id: itemId,
      ownerId: owner,
      wishlistId: firstList,
      wishlistTitle: "ДР",
      title: "",
      sourceUrl: WB,
      priceKopecks: null,
      imageKey: null,
      parseStatus: "pending",
      deleted: false,
    });
    await deleteItem(db, owner, itemId);
    expect((await getBotItemCard(db, itemId))?.deleted).toBe(true);
    expect(await getBotItemCard(db, "nope")).toBeNull();
  });
});

describe("moveItem", () => {
  test("moves only the owner's item into the owner's list", async () => {
    expect(await moveItem(db, stranger, itemId, secondList)).toBe("not_found");
    const foreign = await createWishlist(db, stranger, { title: "Чужой", occasion: "other", eventDate: null });
    if (!foreign.ok) throw new Error("setup");
    expect(await moveItem(db, owner, itemId, foreign.wishlist.id)).toBe("not_found");
    expect(await moveItem(db, owner, itemId, secondList)).toBe("moved");
    expect((await getBotItemCard(db, itemId))?.wishlistId).toBe(secondList);
    expect(await moveItem(db, owner, itemId, secondList)).toBe("moved");
  });

  test("respects the item limit of the target list", async () => {
    const filler = Array.from({ length: MAX_ITEMS_PER_WISHLIST }, (_, i) => ({ wishlistId: secondList, title: `#${i}`, parseStatus: "ok" as const }));
    await db.insert(items).values(filler);
    expect(await moveItem(db, owner, itemId, secondList)).toBe("limit_reached");
  });
});

describe("reservations from the bot", () => {
  test("attaches a site reservation to the Telegram user once", async () => {
    const reservationId = await reservationFor(null);
    expect(await attachReservationToUser(db, reservationId, stranger)).toBe("attached");
    expect(await attachReservationToUser(db, reservationId, stranger)).toBe("already_yours");
    expect(await attachReservationToUser(db, reservationId, owner)).toBe("taken");
    const [row] = await db.select({ guestUserId: reservations.guestUserId }).from(reservations).where(eq(reservations.id, reservationId));
    expect(row?.guestUserId).toBe(stranger);
  });

  test("does not attach cancelled or unknown reservations", async () => {
    const reservationId = await reservationFor(null);
    await db.update(reservations).set({ status: "cancelled" }).where(eq(reservations.id, reservationId));
    expect(await attachReservationToUser(db, reservationId, stranger)).toBe("not_found");
    expect(await attachReservationToUser(db, "bad-id", stranger)).toBe("not_found");
  });

  test("cancels only the user's own active reservation", async () => {
    const reservationId = await reservationFor(stranger);
    expect(await cancelReservationForUser(db, reservationId, owner)).toBe(false);
    expect(await cancelReservationForUser(db, reservationId, stranger)).toBe(true);
    expect(await cancelReservationForUser(db, reservationId, stranger)).toBe(false);
  });
});
