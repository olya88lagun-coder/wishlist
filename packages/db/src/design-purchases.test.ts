import { beforeEach, expect, test } from "vitest";
import { createTestDb, createUserFixture } from "./testing";
import { createWishlist, deleteWishlist } from "./wishlists";
import { attachDesignPayment, beginDesignPurchase, confirmDesignPayment, getDesignAccess, getDesignOrderByPayment, setWishlistTheme, rejectUnattachedDesignPurchase } from "./design-purchases";
import type { Database } from "./types";

let db: Database;
let owner: string;
let stranger: string;
let id: string;
beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Владелец");
  stranger = await createUserFixture(db, "Другой");
  const list = await createWishlist(db, owner, { title: "Праздник", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("fixture");
  id = list.wishlist.id;
});

test("only owner may buy or select a theme; unpaid theme stays locked", async () => {
  expect(await beginDesignPurchase(db, stranger, id, "children", "a@example.com")).toBeNull();
  expect(await setWishlistTheme(db, owner, id, "children")).toBe(false);
  expect(await setWishlistTheme(db, stranger, id, "journal")).toBe(false);
  expect(await getDesignAccess(db, id)).toEqual({ theme: "journal", children: false, invitation: false });
});

test("149/199 prices are server-owned; retries reuse order; pending cannot unlock", async () => {
  const first = await beginDesignPurchase(db, owner, id, "children", "a@example.com");
  expect(first?.amountKopecks).toBe(14900);
  const retry = await beginDesignPurchase(db, owner, id, "children", "b@example.com");
  expect(retry?.id).toBe(first?.id);
  expect(retry?.email).toBe("a@example.com");
  expect(await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com")).toBeNull();
  expect((await getDesignAccess(db, id)).children).toBe(false);
});

test("confirmed payment unlocks just its list and handles duplicate confirmation", async () => {
  const order = (await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com"))!;
  expect(order.amountKopecks).toBe(19900);
  await attachDesignPayment(db, order.id, "provider-1", "https://yoomoney.ru/checkout/test");
  expect(await confirmDesignPayment(db, order.id, "wrong")).toBe(false);
  expect(await confirmDesignPayment(db, order.id, "provider-1")).toBe(true);
  expect(await confirmDesignPayment(db, order.id, "provider-1")).toBe(true);
  expect(await getDesignAccess(db, id)).toEqual({ theme: "children", children: true, invitation: true });
  expect(await setWishlistTheme(db, owner, id, "journal")).toBe(true);
  expect((await getDesignAccess(db, id)).theme).toBe("journal");
  expect(await setWishlistTheme(db, owner, id, "children")).toBe(true);
  expect(await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com")).toBeNull();
});

test("invitation upgrade costs 50 rubles after the 149-ruble theme", async () => {
  const order = (await beginDesignPurchase(db, owner, id, "children", "a@example.com"))!;
  await attachDesignPayment(db, order.id, "provider-1", "https://yoomoney.ru/checkout/test");
  await confirmDesignPayment(db, order.id, "provider-1");
  expect((await getDesignAccess(db, id)).invitation).toBe(false);
  expect((await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com"))?.amountKopecks).toBe(5000);
});

test("test payments never grant real entitlements or consume real purchase", async () => {
  const order = (await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com", true))!;
  await attachDesignPayment(db, order.id, "test-payment", "https://yoomoney.ru/checkout/test");
  await confirmDesignPayment(db, order.id, "test-payment");
  expect(await getDesignAccess(db, id)).toEqual({ theme: "journal", children: false, invitation: false });
  expect((await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com"))?.amountKopecks).toBe(19900);
});

test("rejected draft can be replaced; attached payment cannot be discarded", async () => {
  const first = (await beginDesignPurchase(db, owner, id, "children", "a@example.com"))!;
  await rejectUnattachedDesignPurchase(db, first.id);
  const next = (await beginDesignPurchase(db, owner, id, "children_invitation", "b@example.com"))!;
  expect(next.id).not.toBe(first.id);
  expect(next.email).toBe("b@example.com");
  await attachDesignPayment(db, next.id, "real-payment", "https://yoomoney.ru/checkout/test");
  await rejectUnattachedDesignPurchase(db, next.id);
  expect((await getDesignOrderByPayment(db, "real-payment"))?.status).toBe("pending");
});

test("payment audit record survives list deletion", async () => {
  const order = (await beginDesignPurchase(db, owner, id, "children", "a@example.com"))!;
  await attachDesignPayment(db, order.id, "real-payment", "https://yoomoney.ru/checkout/test");
  expect(await deleteWishlist(db, owner, id)).toBe(true);
  expect((await getDesignOrderByPayment(db, "real-payment"))?.wishlistId).toBe(id);
});
