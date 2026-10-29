import { beforeEach, expect, test } from "vitest";
import { createTestDb, createUserFixture } from "./testing";
import { createWishlist, deleteWishlist } from "./wishlists";
import { attachDesignPayment, beginDesignPurchase, confirmDesignPayment, getDesignAccess, getDesignOrderByPayment, setWishlistTheme, rejectUnattachedDesignPurchase } from "./design-purchases";
import { authIdentities } from "./schema";
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
  expect(await getDesignAccess(db, id)).toEqual({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
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
  expect(await getDesignAccess(db, id)).toEqual({ theme: "children", children: true, invitation: true, newYear: false, celebration: false });
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
  expect(await getDesignAccess(db, id)).toEqual({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
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

test("New Year is a separate 149-ruble theme and does not unlock children or invitations", async () => {
  expect(await setWishlistTheme(db, owner, id, "new-year")).toBe(false);
  const order = (await beginDesignPurchase(db, owner, id, "new_year", "a@example.com"))!;
  expect(order.amountKopecks).toBe(14900);
  await attachDesignPayment(db, order.id, "newyear-payment", "https://yoomoney.ru/checkout/test");
  await confirmDesignPayment(db, order.id, "newyear-payment");
  expect(await getDesignAccess(db, id)).toMatchObject({ theme: "new-year", newYear: true, celebration: false, children: false, invitation: false });
  expect(await setWishlistTheme(db, owner, id, "children-pink")).toBe(false);
  expect(await setWishlistTheme(db, stranger, id, "new-year")).toBe(false);
  expect(await beginDesignPurchase(db, owner, id, "new_year", "a@example.com")).toBeNull();
  expect((await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com"))?.amountKopecks).toBe(19900);
});

test("child bundle does not block a separate New Year purchase", async () => {
  const child = (await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com"))!;
  await attachDesignPayment(db, child.id, "child-payment", "https://yoomoney.ru/checkout/test");
  await confirmDesignPayment(db, child.id, "child-payment");
  const holiday = (await beginDesignPurchase(db, owner, id, "new_year", "a@example.com"))!;
  expect(holiday.amountKopecks).toBe(14900);
  await attachDesignPayment(db, holiday.id, "newyear-payment", "https://yoomoney.ru/checkout/test");
  await confirmDesignPayment(db, holiday.id, "newyear-payment");
  expect(await setWishlistTheme(db, owner, id, "children-pink")).toBe(true);
  expect(await setWishlistTheme(db, owner, id, "new-year")).toBe(true);
});

test("celebration has its own price and rights; test payments do not unlock it", async () => {
  expect(await setWishlistTheme(db, owner, id, "celebration")).toBe(false);
  expect(await beginDesignPurchase(db, stranger, id, "celebration", "a@example.com")).toBeNull();
  const trial = (await beginDesignPurchase(db, owner, id, "celebration", "a@example.com", true))!;
  await attachDesignPayment(db, trial.id, "trial-celebration", null);
  await confirmDesignPayment(db, trial.id, "trial-celebration");
  expect((await getDesignAccess(db, id)).celebration).toBe(false);
  const order = (await beginDesignPurchase(db, owner, id, "celebration", "a@example.com"))!;
  expect(order.amountKopecks).toBe(14900);
  expect((await beginDesignPurchase(db, owner, id, "celebration", "b@example.com"))?.id).toBe(order.id);
  await attachDesignPayment(db, order.id, "celebration-paid", null);
  await confirmDesignPayment(db, order.id, "celebration-paid");
  expect(await getDesignAccess(db, id)).toEqual({ theme: "celebration", celebration: true, children: false, invitation: false, newYear: false });
  expect(await setWishlistTheme(db, stranger, id, "celebration")).toBe(false);
  expect(await setWishlistTheme(db, owner, id, "children")).toBe(false);
  expect(await setWishlistTheme(db, owner, id, "new-year")).toBe(false);
  expect(await setWishlistTheme(db, owner, id, "journal")).toBe(true);
  expect(await setWishlistTheme(db, owner, id, "celebration")).toBe(true);
  expect(await beginDesignPurchase(db, owner, id, "celebration", "a@example.com")).toBeNull();
});

test("child bundle does not block or discount celebration", async () => {
  const child = (await beginDesignPurchase(db, owner, id, "children_invitation", "a@example.com"))!;
  await attachDesignPayment(db, child.id, "child-bundle", null);
  await confirmDesignPayment(db, child.id, "child-bundle");
  const order = (await beginDesignPurchase(db, owner, id, "celebration", "a@example.com"))!;
  expect(order.amountKopecks).toBe(14900);
  await attachDesignPayment(db, order.id, "party-bundle", null);
  await confirmDesignPayment(db, order.id, "party-bundle");
  expect(await setWishlistTheme(db, owner, id, "children-pink")).toBe(true);
  expect(await setWishlistTheme(db, owner, id, "celebration")).toBe(true);
});

const everything = (theme: "journal" | "children" | "children-pink" | "new-year" | "celebration") => ({ theme, children: true, invitation: true, newYear: true, celebration: true });

test("owner from the free list gets every design without payment; others stay locked", async () => {
  await db.insert(authIdentities).values({ userId: owner, provider: "telegram", providerUserId: "777" });
  await db.insert(authIdentities).values({ userId: stranger, provider: "telegram", providerUserId: "888" });
  expect(await getDesignAccess(db, id, ["777"])).toEqual(everything("journal"));
  expect(await getDesignAccess(db, id, ["888"])).toEqual({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
  expect(await getDesignAccess(db, id)).toEqual({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
  expect(await getDesignAccess(db, id, [])).toEqual({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
});

test("a VK account with the same numeric id is not treated as free", async () => {
  await db.insert(authIdentities).values({ userId: owner, provider: "vk", providerUserId: "777" });
  expect((await getDesignAccess(db, id, ["777"])).children).toBe(false);
});

test("free owner can select and keep any theme, a stranger cannot", async () => {
  await db.insert(authIdentities).values({ userId: owner, provider: "telegram", providerUserId: "777" });
  expect(await setWishlistTheme(db, owner, id, "children-pink")).toBe(false);
  expect(await setWishlistTheme(db, owner, id, "children-pink", ["777"])).toBe(true);
  expect(await getDesignAccess(db, id, ["777"])).toEqual(everything("children-pink"));
  expect(await setWishlistTheme(db, owner, id, "new-year", ["777"])).toBe(true);
  expect((await getDesignAccess(db, id, ["777"])).theme).toBe("new-year");
  expect(await setWishlistTheme(db, stranger, id, "journal", ["777"])).toBe(false);
  expect((await getDesignAccess(db, id)).theme).toBe("journal");
});
