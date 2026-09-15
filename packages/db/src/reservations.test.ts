import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem } from "./items";
import { cancelReservation, reserveItem } from "./reservations";
import { reservations } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

let db: Database;
let owner: string;
let slug: string;
let otherSlug: string;
let itemId: string;

const anna = { userId: null, guestToken: "tok-anna" };
const petya = { userId: null, guestToken: "tok-petya" };

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: null });
  const other = await createWishlist(db, owner, { title: "Новый год", occasion: "new_year", eventDate: null });
  if (!list.ok || !other.ok) throw new Error("setup");
  slug = list.wishlist.slug;
  otherSlug = other.wishlist.slug;
  const added = await addItem(db, owner, list.wishlist.id, { title: "Наушники", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!added.ok) throw new Error("setup");
  itemId = added.itemId;
});

async function activeCount() {
  const rows = await db.select().from(reservations).where(and(eq(reservations.itemId, itemId), eq(reservations.status, "active")));
  return rows.length;
}

describe("reserveItem", () => {
  test("guest reserves a free item with a trimmed name and a secret cancel token", async () => {
    expect(await reserveItem(db, { slug, itemId, viewer: anna, guestName: "  Аня " })).toEqual({ ok: true });
    const [row] = await db.select().from(reservations).where(eq(reservations.itemId, itemId));
    expect(row).toMatchObject({ guestName: "Аня", guestToken: "tok-anna", status: "active" });
    expect(row?.cancelToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  test("second guest gets ALREADY_RESERVED", async () => {
    await reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" });
    expect(await reserveItem(db, { slug, itemId, viewer: petya, guestName: "Петя" })).toEqual({ ok: false, reason: "ALREADY_RESERVED" });
  });

  test("two simultaneous reservations: exactly one wins", async () => {
    const results = await Promise.all([
      reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" }),
      reserveItem(db, { slug, itemId, viewer: petya, guestName: "Петя" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "ALREADY_RESERVED" });
    expect(await activeCount()).toBe(1);
  });

  test("owner cannot reserve; invalid name and missing identity are rejected", async () => {
    expect(await reserveItem(db, { slug, itemId, viewer: { userId: owner, guestToken: "t" }, guestName: "Маша" })).toEqual({ ok: false, reason: "OWNER_CANNOT_RESERVE" });
    expect(await reserveItem(db, { slug, itemId, viewer: anna, guestName: " " })).toEqual({ ok: false, reason: "INVALID_NAME" });
    expect(await reserveItem(db, { slug, itemId, viewer: { userId: null, guestToken: null }, guestName: "X" })).toEqual({ ok: false, reason: "NO_IDENTITY" });
  });

  test("NOT_FOUND for wrong slug, deleted item or malformed ids", async () => {
    expect(await reserveItem(db, { slug: otherSlug, itemId, viewer: anna, guestName: "Аня" })).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await reserveItem(db, { slug, itemId: "nope", viewer: anna, guestName: "Аня" })).toEqual({ ok: false, reason: "NOT_FOUND" });
    await deleteItem(db, owner, itemId);
    expect(await reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" })).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

describe("cancelReservation", () => {
  test("only the guest who reserved can cancel, then the item is free again", async () => {
    await reserveItem(db, { slug, itemId, viewer: anna, guestName: "Аня" });
    expect(await cancelReservation(db, { slug, itemId, viewer: petya })).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
    expect(await cancelReservation(db, { slug, itemId, viewer: { userId: owner, guestToken: null } })).toEqual({ ok: false, reason: "NOT_YOUR_RESERVATION" });
    expect(await cancelReservation(db, { slug, itemId, viewer: anna })).toEqual({ ok: true });
    expect(await activeCount()).toBe(0);
    expect(await reserveItem(db, { slug, itemId, viewer: petya, guestName: "Петя" })).toEqual({ ok: true });
  });

  test("NOT_RESERVED for a free item, NOT_FOUND for a wrong slug", async () => {
    expect(await cancelReservation(db, { slug, itemId, viewer: anna })).toEqual({ ok: false, reason: "NOT_RESERVED" });
    expect(await cancelReservation(db, { slug: otherSlug, itemId, viewer: anna })).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});
