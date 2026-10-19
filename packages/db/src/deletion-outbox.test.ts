import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, test } from "vitest";
import { claimWishlistDeletionNotice, finishWishlistDeletionNotice, retryWishlistDeletionNotice } from "./deletion-outbox";
import { wishlistDeletionNotices } from "./schema";
import { createTestDb, createUserFixture } from "./testing";
import type { Database } from "./types";

let db: Database;
let now: Date;
let id: string;
beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => {
  await db.delete(wishlistDeletionNotices);
  now = new Date(Date.now() + 1000);
  const guest = await createUserFixture(db, "Даритель");
  const [notice] = await db.insert(wishlistDeletionNotices).values({ wishlistId: randomUUID(), guestUserId: guest, wishlistTitle: "Частный список" }).returning();
  id = notice!.id;
});

test("only one concurrent worker leases a pending notice", async () => {
  const results = await Promise.all([claimWishlistDeletionNotice(db, now), claimWishlistDeletionNotice(db, now)]);
  const leased = results.filter((result) => result !== null);
  expect(leased).toHaveLength(1);
  expect(leased[0]).toMatchObject({ id, attempts: 1, wishlistTitle: "Частный список" });
  expect(leased[0]!.leaseToken).toMatch(/^[a-f0-9-]{36}$/);
  expect(leased[0]!.leaseUntil!.getTime()).toBeGreaterThan(now.getTime());
});

test("a crashed worker's expired lease is recovered and fenced from acknowledging a new lease", async () => {
  const old = (await claimWishlistDeletionNotice(db, now))!;
  expect(old).not.toBeNull();
  const later = new Date(now.getTime() + 6 * 60_000);
  const recovered = (await claimWishlistDeletionNotice(db, later))!;
  expect(recovered).toMatchObject({ id, attempts: 2 });
  expect(recovered.leaseToken).not.toBe(old.leaseToken);
  expect(await finishWishlistDeletionNotice(db, old, later, "sent")).toBe(false);
  expect(await finishWishlistDeletionNotice(db, recovered, later, "sent")).toBe(true);
});

test("temporary failure waits before retry, while the snapshot remains intact", async () => {
  const notice = (await claimWishlistDeletionNotice(db, now))!;
  expect(notice).not.toBeNull();
  expect(await retryWishlistDeletionNotice(db, notice, now)).toBe(true);
  expect(await claimWishlistDeletionNotice(db, now)).toBeNull();
  const retried = await claimWishlistDeletionNotice(db, new Date(now.getTime() + 61_000));
  expect(retried).toMatchObject({ id, attempts: 2, wishlistTitle: "Частный список" });
});

test.each(["sent", "rejected", "no_telegram"] as const)("terminal outcome %s cannot be sent twice and removes the title snapshot", async (outcome) => {
  const notice = (await claimWishlistDeletionNotice(db, now))!;
  expect(notice).not.toBeNull();
  expect(await finishWishlistDeletionNotice(db, notice, now, outcome)).toBe(true);
  expect(await finishWishlistDeletionNotice(db, notice, now, outcome)).toBe(false);
  expect(await claimWishlistDeletionNotice(db, new Date(now.getTime() + 24 * 60 * 60_000))).toBeNull();
  const [saved] = await db.select().from(wishlistDeletionNotices).where(eq(wishlistDeletionNotices.id, id));
  expect(saved).toMatchObject({ outcome, wishlistTitle: "", leaseToken: null, leaseUntil: null });
  expect(saved!.completedAt).not.toBeNull();
});
