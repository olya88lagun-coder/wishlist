import { isValidSlug } from "@wishlist/core";
import { beforeEach, describe, expect, test } from "vitest";
import { MAX_WISHLISTS_PER_USER } from "./limits";
import { items } from "./schema";
import { createTestDb } from "./testing";
import { createUserFixture } from "./test-fixtures";
import type { Database } from "./types";
import { createWishlist, deleteWishlist, getOwnedWishlist, listWishlistsForOwner, updateWishlist } from "./wishlists";

let db: Database;
let owner: string;
let stranger: string;
const input = { title: "Маше тридцать", occasion: "birthday" as const, eventDate: "2026-03-14" };

beforeEach(async () => {
  db = await createTestDb();
  owner = await createUserFixture(db, "Маша");
  stranger = await createUserFixture(db, "Петя");
});

async function created() {
  const result = await createWishlist(db, owner, input);
  if (!result.ok) throw new Error("setup");
  return result.wishlist;
}

describe("createWishlist", () => {
  test("creates a list with a valid random slug and zero items", async () => {
    const list = await created();
    expect(list).toMatchObject({ title: "Маше тридцать", occasion: "birthday", eventDate: "2026-03-14", itemCount: 0 });
    expect(isValidSlug(list.slug)).toBe(true);
  });

  test("stops at the per-user limit", async () => {
    for (let i = 0; i < MAX_WISHLISTS_PER_USER; i++) await createWishlist(db, owner, { ...input, title: `Список ${i}` });
    expect(await createWishlist(db, owner, input)).toEqual({ ok: false, reason: "LIMIT_REACHED" });
    expect((await createWishlist(db, stranger, input)).ok).toBe(true);
  });
});

describe("listWishlistsForOwner", () => {
  test("returns only own lists, newest first, counting non-deleted items", async () => {
    const first = await created();
    await new Promise((resolve) => setTimeout(resolve, 5)); // разные created_at
    const second = await created();
    await createWishlist(db, stranger, { ...input, title: "Чужой" });
    await db.insert(items).values([
      { wishlistId: first.id, title: "A", parseStatus: "ok" },
      { wishlistId: first.id, title: "B", parseStatus: "ok", deletedAt: new Date() },
    ]);
    const lists = await listWishlistsForOwner(db, owner);
    expect(lists.map((l) => l.id)).toEqual([second.id, first.id]);
    expect(lists.find((l) => l.id === first.id)?.itemCount).toBe(1);
  });
});

describe("ownership", () => {
  test("stranger cannot read, update or delete someone else's list", async () => {
    const list = await created();
    expect(await getOwnedWishlist(db, stranger, list.id)).toBeNull();
    expect(await updateWishlist(db, stranger, list.id, { ...input, title: "Взлом" })).toBe(false);
    expect(await deleteWishlist(db, stranger, list.id)).toBe(false);
    expect((await getOwnedWishlist(db, owner, list.id))?.title).toBe("Маше тридцать");
  });

  test("owner can update and delete", async () => {
    const list = await created();
    expect(await updateWishlist(db, owner, list.id, { title: "Новый год", occasion: "new_year", eventDate: null })).toBe(true);
    expect(await getOwnedWishlist(db, owner, list.id)).toMatchObject({ title: "Новый год", occasion: "new_year", eventDate: null, slug: list.slug });
    expect(await deleteWishlist(db, owner, list.id)).toBe(true);
    expect(await getOwnedWishlist(db, owner, list.id)).toBeNull();
  });

  test("malformed ids return null/false instead of throwing", async () => {
    expect(await getOwnedWishlist(db, owner, "not-a-uuid")).toBeNull();
    expect(await updateWishlist(db, owner, "../../etc", input)).toBe(false);
    expect(await deleteWishlist(db, owner, "1")).toBe(false);
  });
});
