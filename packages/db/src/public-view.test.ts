import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";
import { addItem, deleteItem } from "./items";
import { getPublicWishlist } from "./public-view";
import { reservations, users } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist } from "./wishlists";

let db: Database;
let owner: string;
let guestUser: string;
let slug: string;
let freeId: string;
let reservedId: string;

const anna = { userId: null, guestToken: "tok-anna" };
const petya = { userId: null, guestToken: "tok-petya" };
const item = { sourceUrl: null, priceKopecks: 100000, note: null, isMustHave: false };

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  guestUser = await createUserFixture(db, "Оля");
  const list = await createWishlist(db, owner, { title: "Маше 30", occasion: "birthday", eventDate: "2026-03-14" });
  if (!list.ok) throw new Error("setup");
  slug = list.wishlist.slug;
  const a = await addItem(db, owner, list.wishlist.id, { ...item, title: "Свеча" });
  const b = await addItem(db, owner, list.wishlist.id, { ...item, title: "Наушники" });
  if (!a.ok || !b.ok) throw new Error("setup");
  freeId = a.itemId;
  reservedId = b.itemId;
  await db.insert(reservations).values({ itemId: reservedId, guestName: "СекретнаяАня", guestToken: "tok-anna", cancelToken: "cancel-secret" });
});

const statusOf = (view: Awaited<ReturnType<typeof getPublicWishlist>>, id: string) => view?.items.find((i) => i.id === id)?.status;

describe("getPublicWishlist", () => {
  test("shows list header and owner first name", async () => {
    const view = await getPublicWishlist(db, slug, petya);
    expect(view).toMatchObject({ ownerName: "Маша", isOwner: false, wishlist: { title: "Маше 30", eventDate: "2026-03-14", slug } });
  });

  test("statuses depend on who is looking", async () => {
    expect(statusOf(await getPublicWishlist(db, slug, anna), reservedId)).toBe("reserved_by_me");
    expect(statusOf(await getPublicWishlist(db, slug, petya), reservedId)).toBe("reserved_by_other");
    expect(statusOf(await getPublicWishlist(db, slug, petya), freeId)).toBe("free");
  });

  test("owner sees reserved_by_other, or free in surprise mode", async () => {
    const asOwner = { userId: owner, guestToken: null };
    const view = await getPublicWishlist(db, slug, asOwner);
    expect(view?.isOwner).toBe(true);
    expect(statusOf(view, reservedId)).toBe("reserved_by_other");
    await db.update(users).set({ surpriseMode: true }).where(eq(users.id, owner));
    expect(statusOf(await getPublicWishlist(db, slug, asOwner), reservedId)).toBe("free");
  });

  test("PRIVACY: never exposes guest names or tokens", async () => {
    const json = JSON.stringify(await getPublicWishlist(db, slug, anna));
    for (const secret of ["СекретнаяАня", "tok-anna", "cancel-secret"]) expect(json).not.toContain(secret);
  });

  test("hides deleted items and returns null for unknown or malformed slugs", async () => {
    await deleteItem(db, owner, freeId);
    expect((await getPublicWishlist(db, slug, petya))?.items.map((i) => i.id)).toEqual([reservedId]);
    expect(await getPublicWishlist(db, "AAAAAAAAAA", petya)).toBeNull();
    expect(await getPublicWishlist(db, "../etc", petya)).toBeNull();
  });

  test("matches a logged-in guest by user id", async () => {
    await db.insert(reservations).values({ itemId: freeId, guestName: "Оля", guestUserId: guestUser, cancelToken: "c2" });
    expect(statusOf(await getPublicWishlist(db, slug, { userId: guestUser, guestToken: null }), freeId)).toBe("reserved_by_me");
  });

  test("only the site guest who reserved gets the reservation id for Telegram reminders", async () => {
    const [row] = await db.select({ id: reservations.id }).from(reservations).where(eq(reservations.itemId, reservedId));
    const remindOf = (view: Awaited<ReturnType<typeof getPublicWishlist>>, id: string) => view?.items.find((i) => i.id === id)?.remindReservationId;
    expect(remindOf(await getPublicWishlist(db, slug, anna), reservedId)).toBe(row!.id);
    expect(remindOf(await getPublicWishlist(db, slug, petya), reservedId)).toBeNull();
    expect(remindOf(await getPublicWishlist(db, slug, { userId: owner, guestToken: null }), reservedId)).toBeNull();
    expect(remindOf(await getPublicWishlist(db, slug, anna), freeId)).toBeNull();

    await db.insert(reservations).values({ itemId: freeId, guestName: "Оля", guestUserId: guestUser, cancelToken: "c3" });
    expect(remindOf(await getPublicWishlist(db, slug, { userId: guestUser, guestToken: null }), freeId)).toBeNull();
  });
});

describe("pending items", () => {
  test("guests do not see link-only items that are still parsing", async () => {
    const pendingOwner = await createUserFixture(db, "Оля");
    const list = await createWishlist(db, pendingOwner, { title: "Скоро", occasion: "other", eventDate: null });
    if (!list.ok) throw new Error("setup");
    await addItem(db, pendingOwner, list.wishlist.id, { title: "", sourceUrl: "https://www.wildberries.ru/catalog/1/detail.aspx", priceKopecks: null, note: null, isMustHave: false });
    await addItem(db, pendingOwner, list.wishlist.id, { title: "С названием", sourceUrl: "https://www.wildberries.ru/catalog/2/detail.aspx", priceKopecks: null, note: null, isMustHave: false });
    const view = await getPublicWishlist(db, list.wishlist.slug, { userId: null, guestToken: null });
    expect(view?.items.map((item) => item.title)).toEqual(["С названием"]);
    expect(view?.items[0]).toMatchObject({ imageKey: null });
  });
});
