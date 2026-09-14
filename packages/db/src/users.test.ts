import { beforeEach, describe, expect, test } from "vitest";
import { createTestDb } from "./testing";
import type { Database } from "./types";
import { getUserWithIdentities, linkIdentity, upsertUserFromIdentity } from "./users";

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

  test("refuses to steal an identity that belongs to another user", async () => {
    await upsertUserFromIdentity(db, vk);
    const other = await upsertUserFromIdentity(db, tg);
    expect(await linkIdentity(db, other.id, vk)).toEqual({ ok: false, reason: "IDENTITY_TAKEN" });
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
