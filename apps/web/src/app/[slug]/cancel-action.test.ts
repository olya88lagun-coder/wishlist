import { addItem, createWishlist, getPublicWishlist, reserveItem, type Database } from "@wishlist/db";
import { createTestDb, createUserFixture } from "@wishlist/db/testing";
import type { Viewer } from "@wishlist/core";
import { beforeAll, beforeEach, expect, test, vi } from "vitest";
import { initialFormState } from "../lists/form-state";

let db: Database;
let slug: string;
let itemId: string;
let viewer: Viewer;
let allowed: boolean;
let unavailable: boolean;
const guest: Viewer = { userId: null, guestToken: "test-reservation-owner" };
vi.mock("@/server/db", () => ({ getDb: () => { if (unavailable) throw new Error("database unavailable"); return db; } }));
vi.mock("@/server/viewer", () => ({
  readViewer: () => ({ viewer, user: null }),
  ensureGuestViewer: vi.fn(() => ({ viewer, user: null })),
  clientKey: () => "test-cancel",
}));
vi.mock("@/server/rate-limit", () => ({ reservationLimiter: { allow: () => allowed } }));
vi.mock("@/server/queue", () => ({ enqueueNotify: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { ensureGuestViewer } from "@/server/viewer";
import { cancelAction } from "./actions";

beforeAll(async () => { db = await createTestDb(); });
beforeEach(async () => {
  vi.clearAllMocks();
  viewer = guest; allowed = true; unavailable = false;
  const owner = await createUserFixture(db, "Владелец");
  const list = await createWishlist(db, owner, { title: "Тест отмены", occasion: "birthday", eventDate: null });
  if (!list.ok) throw new Error("list fixture");
  slug = list.wishlist.slug;
  const item = await addItem(db, owner, list.wishlist.id, { title: "Свеча", sourceUrl: null, priceKopecks: null, note: null, isMustHave: false });
  if (!item.ok) throw new Error("item fixture");
  itemId = item.itemId;
  expect(await reserveItem(db, { slug, itemId, viewer: guest, guestName: "Тайный гость" })).toEqual({ ok: true });
});

const cancel = () => cancelAction(slug, itemId, initialFormState, new FormData());
const status = async () => (await getPublicWishlist(db, slug, guest))?.items[0]?.status;

test("returns a successful cancellation only after the gift is released", async () => {
  expect(await cancel()).toMatchObject({ status: "success", message: "Ваша бронь снята." });
  expect(await status()).toBe("free");
});

test("explains the rate limit and keeps the reservation", async () => {
  allowed = false;
  expect(await cancel()).toMatchObject({ status: "error", message: expect.stringMatching(/Бронь не снята.*Подождите минуту/) });
  expect(await status()).toBe("reserved_by_me");
});

test("an expired guest identity is not replaced and cannot cancel the gift", async () => {
  viewer = { userId: null, guestToken: null };
  expect(await cancel()).toMatchObject({ status: "error", message: expect.stringMatching(/Не удалось подтвердить вашу бронь/) });
  expect(ensureGuestViewer).not.toHaveBeenCalled();
  expect(await status()).toBe("reserved_by_me");
});

test("a different browser cannot cancel the reservation or learn the guest name", async () => {
  viewer = { userId: null, guestToken: "different-browser" };
  const result = await cancel();
  expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/Не удалось подтвердить вашу бронь/) });
  expect(JSON.stringify(result)).not.toContain("Тайный гость");
  expect(await status()).toBe("reserved_by_me");
});

test("repeated cancellation explains that the reservation is already removed", async () => {
  await cancel();
  expect(await cancel()).toMatchObject({ status: "success", message: "Бронь уже снята" });
  expect(await status()).toBe("free");
});

test("a signed-in guest can cancel their user-bound reservation without a guest cookie", async () => {
  await cancel();
  viewer = { userId: await createUserFixture(db, "Даритель"), guestToken: null };
  expect(await reserveItem(db, { slug, itemId, viewer, guestName: "Даритель" })).toEqual({ ok: true });
  expect(await cancel()).toMatchObject({ status: "success", message: "Ваша бронь снята." });
  expect(await status()).toBe("free");
});

test("simultaneous cancellations both report an understandable result", async () => {
  const results = await Promise.all([cancel(), cancel()]);
  expect(results.every((result) => result?.status === "success" && /бронь/i.test(result.message ?? ""))).toBe(true);
  expect(await status()).toBe("free");
});

test("an unavailable gift returns a message instead of silent completion", async () => {
  itemId = "00000000-0000-4000-8000-000000000000";
  expect(await cancel()).toMatchObject({ status: "error", message: "Подарок не найден — возможно, его удалили" });
});

test("a server failure returns a retryable result without exposing internals", async () => {
  unavailable = true;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await cancel();
    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/Не удалось подтвердить отмену/) });
    expect(JSON.stringify(result)).not.toContain("database unavailable");
  } finally { log.mockRestore(); unavailable = false; }
  expect(await status()).toBe("reserved_by_me");
});
