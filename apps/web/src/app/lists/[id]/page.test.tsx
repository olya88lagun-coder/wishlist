import { getDesignAccess, getOwnerWishlistView } from "@wishlist/db";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("@wishlist/db", () => ({ getOwnerWishlistView: vi.fn(), getDesignAccess: vi.fn() }));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/viewer", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "owner-1" }) }));
vi.mock("@/server/env", () => ({ getEnv: () => ({ APP_URL: "http://localhost:3000", S3_PUBLIC_BASE_URL: undefined }) }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ updateListAction: vi.fn(), deleteListAction: vi.fn(), addItemAction: vi.fn(), updateItemAction: vi.fn(), deleteItemAction: vi.fn(), themeInterestAction: vi.fn() }));

import OwnerListPage from "./page";

const view = {
  wishlist: { id: "list-1", title: "Для Таюшки", occasion: "birthday", eventDate: null, slug: "abcdefghij", themeId: "children-pink" },
  items: [],
  surpriseMode: false,
};

beforeEach(() => {
  vi.mocked(getOwnerWishlistView).mockResolvedValue(view as never);
});

test("owner sees the purchased theme on the management page, not only guests on the public page", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "children-pink", children: true, invitation: false, newYear: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain('data-theme="children-pink"');
  expect(html).toMatch(/<main class="[^"]*\bwishlist-page\b/);
  expect(html).toContain("Для Таюшки");
  expect(html).toContain("Оформление и приглашение");
});

test("without a purchased theme the management page keeps the plain journal look", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "journal", children: false, invitation: false, newYear: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain('data-theme="journal"');
  expect(html).not.toContain("wishlist-page");
});
