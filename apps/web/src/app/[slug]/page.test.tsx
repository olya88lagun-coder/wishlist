import type { PublicWishlistView } from "@wishlist/db";
import { getPublicWishlist } from "@wishlist/db";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("@wishlist/db", () => ({ getPublicWishlist: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/viewer", () => ({ readViewer: vi.fn() }));
vi.mock("@/server/env", () => ({
  getEnv: () => ({
    APP_URL: "http://localhost:3000",
    TELEGRAM_BOT_USERNAME: "wishlist_test_bot",
    SESSION_SECRET: "local-test-secret-local-test-secret",
  }),
}));
vi.mock("./actions", () => ({ reserveAction: vi.fn(), cancelAction: vi.fn(), cancelFormAction: vi.fn() }));

import { readViewer } from "@/server/viewer";
import PublicWishlistPage from "./page";

function wishlist(status: PublicWishlistView["items"][number]["status"], isOwner = false): PublicWishlistView {
  return {
    wishlist: { id: "test-list", title: "Тестовый праздник", occasion: "birthday", eventDate: null, slug: "abcdefghij" },
    ownerName: "Тестовый владелец",
    isOwner,
    items: [{
      id: "test-gift", title: "Тестовый подарок", sourceUrl: null, store: null,
      priceKopecks: null, currency: "RUB", note: null, isMustHave: false,
      imageKey: null, status, remindReservationId: null,
    }],
  };
}

beforeEach(() => {
  vi.mocked(readViewer).mockResolvedValue({ viewer: { userId: null, guestToken: "test-guest" }, user: null });
});

test("shows one invitation before the gifts only when this guest has a reservation", async () => {
  vi.mocked(getPublicWishlist).mockResolvedValue(wishlist("reserved_by_me"));
  const html = renderToStaticMarkup(await PublicWishlistPage({ params: Promise.resolve({ slug: "abcdefghij" }) }));

  expect(html.match(/aria-label="Свой вишлист"/g)).toHaveLength(1);
  expect(html.indexOf('aria-label="Свой вишлист"')).toBeLessThan(html.indexOf('aria-label="Подарки"'));
  expect(html).toContain('href="/login"');
  expect(html).toContain("Создать свой список");
  expect(html).toContain("Снять бронь");
});

test.each(["free", "reserved_by_other"] as const)("keeps the invitation after the gifts for status %s", async (status) => {
  vi.mocked(getPublicWishlist).mockResolvedValue(wishlist(status));
  const html = renderToStaticMarkup(await PublicWishlistPage({ params: Promise.resolve({ slug: "abcdefghij" }) }));

  expect(html.match(/aria-label="Свой вишлист"/g)).toHaveLength(1);
  expect(html.indexOf('aria-label="Свой вишлист"')).toBeGreaterThan(html.indexOf('aria-label="Подарки"'));
});

test("does not invite the owner to create another list while viewing their own gifts", async () => {
  vi.mocked(getPublicWishlist).mockResolvedValue(wishlist("free", true));
  const html = renderToStaticMarkup(await PublicWishlistPage({ params: Promise.resolve({ slug: "abcdefghij" }) }));
  expect(html).not.toContain('aria-label="Свой вишлист"');
});
