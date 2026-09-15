import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb } from "./testing";
import type { Database } from "./types";
import { eq } from "drizzle-orm";
import { addItem } from "./items";
import { reservations, users } from "./schema";
import { getUserWithIdentities, isProfileEmpty, linkIdentity, setSurpriseMode, upsertUserFromIdentity } from "./users";
import { createWishlist } from "./wishlists";

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
});

const tg = { provider: "telegram" as const, providerUserId: "42", displayName: "Маша", avatarUrl: null };
const vk = { provider: "vk" as const, providerUserId: "777", displayName: "Мария", avatarUrl: "https://vk.ru/a.jpg" };

describe("upsertUserFromIdentity", () => {
  test("creates a user on first login", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(user).toMatchObject({ displayName: "Маша", avatarUrl: null, surpriseMode: false });
    expect(await getUserWithIdentities(db, user.id)).toMatchObject({ providers: ["telegram"] });
  });

  test("returns the same user on repeated login and refreshes the avatar", async () => {
    const first = await upsertUserFromIdentity(db, tg);
    const second = await upsertUserFromIdentity(db, { ...tg, avatarUrl: "https://t.me/new.jpg" });
    expect(second.id).toBe(first.id);
    expect(second.avatarUrl).toBe("https://t.me/new.jpg");
  });

  test("repeated login without avatar keeps the stored avatar", async () => {
    const first = await upsertUserFromIdentity(db, vk);
    const second = await upsertUserFromIdentity(db, { ...vk, avatarUrl: null });
    expect(second).toMatchObject({ id: first.id, avatarUrl: "https://vk.ru/a.jpg" });
  });

  test("keeps different providers as different users until linked", async () => {
    const a = await upsertUserFromIdentity(db, tg);
    const b = await upsertUserFromIdentity(db, vk);
    expect(a.id).not.toBe(b.id);
  });
});

describe("linkIdentity", () => {
  test("links a second provider so both logins resolve to one user", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, user.id, vk)).toEqual({ ok: true });
    expect((await upsertUserFromIdentity(db, vk)).id).toBe(user.id);
    const withIds = await getUserWithIdentities(db, user.id);
    expect(withIds?.providers.sort()).toEqual(["telegram", "vk"]);
  });

  test("refuses to steal an identity from a profile that has data", async () => {
    const vkUser = await upsertUserFromIdentity(db, vk);
    await createWishlist(db, vkUser.id, { title: "Мой список", occasion: "other", eventDate: null });
    const other = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, other.id, vk)).toEqual({ ok: false, reason: "IDENTITY_TAKEN" });
  });

  test("merges an identity from an empty profile and deletes that profile", async () => {
    const emptyVkProfile = await upsertUserFromIdentity(db, vk);
    const current = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, current.id, vk)).toEqual({ ok: true });
    expect(await getUserWithIdentities(db, emptyVkProfile.id)).toBeNull();
    expect((await getUserWithIdentities(db, current.id))?.providers.sort()).toEqual(["telegram", "vk"]);
    expect((await upsertUserFromIdentity(db, vk)).id).toBe(current.id);
  });

  test("does not merge a profile that reserved gifts as a guest", async () => {
    const vkUser = await upsertUserFromIdentity(db, vk);
    const owner = await upsertUserFromIdentity(db, { ...tg, providerUserId: "999" });
    const list = await createWishlist(db, owner.id, { title: "Чужой", occasion: "other", eventDate: null });
    if (!list.ok) throw new Error("setup");
    const item = await addItem(db, owner.id, list.wishlist.id, { title: "X", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
    if (!item.ok) throw new Error("setup");
    await db.insert(reservations).values({ itemId: item.itemId, guestUserId: vkUser.id, guestName: "Мария", cancelToken: "c" });
    const current = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, current.id, vk)).toEqual({ ok: false, reason: "IDENTITY_TAKEN" });
  });

  test("merge still respects one account per provider", async () => {
    await upsertUserFromIdentity(db, { ...vk, providerUserId: "888" });
    const current = await upsertUserFromIdentity(db, tg);
    await linkIdentity(db, current.id, vk);
    expect(await linkIdentity(db, current.id, { ...vk, providerUserId: "888" })).toEqual({ ok: false, reason: "PROVIDER_ALREADY_LINKED" });
  });

  test("refuses a second account of the same provider", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, user.id, { ...tg, providerUserId: "43" })).toEqual({ ok: false, reason: "PROVIDER_ALREADY_LINKED" });
  });

  test("is a no-op when the identity is already linked to the same user", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, user.id, tg)).toEqual({ ok: true });
  });
});

describe("getUserWithIdentities", () => {
  test("returns null for an unknown id", async () => {
    expect(await getUserWithIdentities(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("isProfileEmpty", () => {
  test("true for a fresh user, false once they own a list", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    expect(await isProfileEmpty(db, user.id)).toBe(true);
    await createWishlist(db, user.id, { title: "Список", occasion: "other", eventDate: null });
    expect(await isProfileEmpty(db, user.id)).toBe(false);
  });
});

describe("setSurpriseMode", () => {
  test("toggles the flag", async () => {
    const user = await upsertUserFromIdentity(db, tg);
    await setSurpriseMode(db, user.id, true);
    expect((await getUserWithIdentities(db, user.id))?.surpriseMode).toBe(true);
    await setSurpriseMode(db, user.id, false);
    const [row] = await db.select({ surpriseMode: users.surpriseMode }).from(users).where(eq(users.id, user.id));
    expect(row?.surpriseMode).toBe(false);
  });
});
