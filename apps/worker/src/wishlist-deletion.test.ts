import { randomUUID } from "node:crypto";
import {
  authIdentities, claimWishlistDeletionNotice, createWishlist, deleteWishlist, getWishlistDeletionTelegramId, items, linkIdentity, notificationLog, reservations, wishlistDeletionNotices,
  type Database,
} from "@wishlist/db";
import { createTestDb, createUserFixture } from "@wishlist/db/testing";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { runWishlistDeletionNotices } from "./wishlist-deletion";
import type { DeliveryDeps } from "./delivery";
import type { SendOutcome } from "./telegram/messenger";
import type { PgBoss } from "pg-boss";
import { registerJobs, type JobDeps } from "./jobs";

let db: Database;
let guest: string;
let now: Date;
let outcome: SendOutcome | "throw";
let sequence = 100;
const send = vi.fn(async (_chatId: number, _text: string) => {
  if (outcome === "throw") throw new Error("transport unavailable");
  return outcome;
});
const deps = (): DeliveryDeps => ({ db, messenger: { send, edit: async () => "sent" }, now: () => now, log: () => {} });

beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => {
  send.mockClear(); outcome = "sent";
  await db.delete(wishlistDeletionNotices);
  const owner = await createUserFixture(db, "Имя владельца");
  guest = await createUserFixture(db, "Секретное имя дарителя");
  await db.insert(authIdentities).values({ userId: guest, provider: "telegram", providerUserId: String(sequence++) });
  const list = await createWishlist(db, owner, { title: "Праздник <для друзей>", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("fixture");
  const gifts = await db.insert(items).values([
    { wishlistId: list.wishlist.id, title: "Первый подарок" }, { wishlistId: list.wishlist.id, title: "Второй подарок" },
  ]).returning();
  await db.insert(reservations).values(gifts.map((gift) => ({ itemId: gift.id, guestUserId: guest, guestName: "Секретное имя дарителя", cancelToken: randomUUID() })));
  await deleteWishlist(db, owner, list.wishlist.id);
  now = new Date(Date.now() + 1000);
});

test("a deleted list produces one escaped notice for its guest, without a dead link or private names", async () => {
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]![1]).toContain("Праздник &lt;для друзей&gt;");
  expect(send.mock.calls[0]![1]).toContain("Ваши брони в нём больше не действуют");
  expect(JSON.stringify(send.mock.calls)).not.toMatch(/Секретное имя|Имя владельца|https?:\/\//);
  const [saved] = await db.select().from(wishlistDeletionNotices);
  expect(saved).toMatchObject({ outcome: "sent", wishlistTitle: "" });
  expect(saved!.completedAt).not.toBeNull();
});

test("concurrent polling and repeated jobs do not duplicate a completed notice", async () => {
  await Promise.all([runWishlistDeletionNotices(deps()), runWishlistDeletionNotices(deps())]);
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(1);
});

test("linking a Telegram identity preserves a pending deletion notice and its active lease", async () => {
  const [identity] = await db.select().from(authIdentities).where(eq(authIdentities.userId, guest));
  const target = await createUserFixture(db, "Основной профиль");
  const leased = await claimWishlistDeletionNotice(db, now);
  expect(await linkIdentity(db, target, {
    provider: "telegram", providerUserId: identity!.providerUserId, displayName: "Telegram", avatarUrl: null,
  })).toEqual({ ok: true });
  expect((await db.select().from(wishlistDeletionNotices))[0]).toMatchObject({ id: leased!.id, guestUserId: target, leaseToken: leased!.leaseToken });
  expect(await getWishlistDeletionTelegramId(db, leased!)).toBe(Number(identity!.providerUserId));
  now = new Date(now.getTime() + 5 * 60_000 + 1);
  await runWishlistDeletionNotices(deps());
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0]![0]).toBe(Number(identity!.providerUserId));
});

test.each(["failed", "throw"] as const)("temporary failure %s preserves the snapshot until a later poll succeeds", async (failure) => {
  outcome = failure;
  await runWishlistDeletionNotices(deps());
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(1);
  const [pending] = await db.select().from(wishlistDeletionNotices);
  expect(pending).toMatchObject({ completedAt: null, attempts: 1, wishlistTitle: "Праздник <для друзей>" });
  outcome = "sent"; now = new Date(now.getTime() + 61_000);
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(2);
  const [saved] = await db.select().from(wishlistDeletionNotices);
  expect(saved).toMatchObject({ outcome: "sent", wishlistTitle: "", attempts: 2 });
});

test("permanent Telegram refusal is recorded without endless retry", async () => {
  outcome = "rejected";
  await runWishlistDeletionNotices(deps());
  now = new Date(now.getTime() + 24 * 60 * 60_000);
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.select().from(wishlistDeletionNotices))[0]).toMatchObject({ outcome: "rejected", wishlistTitle: "" });
});

test("a disconnected Telegram account gets no message and its title snapshot is cleared", async () => {
  await db.delete(authIdentities).where(eq(authIdentities.userId, guest));
  await runWishlistDeletionNotices(deps());
  expect(send).not.toHaveBeenCalled();
  expect((await db.select().from(wishlistDeletionNotices))[0]).toMatchObject({ outcome: "no_telegram", wishlistTitle: "" });
});

test("important deletion notices are not suppressed by the ordinary two-message daily limit", async () => {
  await db.insert(notificationLog).values([
    { userId: guest, kind: "guest_reserved", refId: randomUUID(), sentOn: "2026-10-19" },
    { userId: guest, kind: "reminder", refId: randomUUID(), sentOn: "2026-10-19" },
  ]);
  await runWishlistDeletionNotices(deps());
  expect(send).toHaveBeenCalledTimes(1);
});

test("the registered worker polls durable deletion notices every minute", async () => {
  const handlers = new Map<string, () => Promise<void>>();
  const schedule = vi.fn(async () => {});
  const boss = {
    createQueue: vi.fn(async () => {}), schedule, unschedule: vi.fn(async () => {}),
    work: async (name: string, ...args: unknown[]) => { handlers.set(name, args.at(-1) as () => Promise<void>); },
  } as unknown as PgBoss;
  const jobDeps: JobDeps = {
    ...deps(), databaseUrl: "unused", fetcher: {} as JobDeps["fetcher"], waitTurn: async () => {},
    storage: null, s3: null, imagesPublicBaseUrl: null,
    telegram: { token: "local-test-token", appUrl: "https://example.com", sessionSecret: "s".repeat(32), adminId: null },
  };
  await registerJobs(boss, jobDeps);
  expect(schedule).toHaveBeenCalledWith("wishlist-deletion", "* * * * *", {}, { tz: "Europe/Moscow" });
  const handler = handlers.get("wishlist-deletion");
  expect(handler).toBeTypeOf("function");
  await handler!();
  expect(send).toHaveBeenCalledTimes(1);
});
