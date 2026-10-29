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
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "children-pink", children: true, invitation: false, newYear: false, celebration: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain('data-theme="children-pink"');
  expect(html).toMatch(/<main class="[^"]*\bwishlist-page\b/);
  expect(html).toContain("Для Таюшки");
});

test("without a purchased theme the management page keeps the plain journal look", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain('data-theme="journal"');
  expect(html).not.toContain("wishlist-page");
});

const gotoDesign = 'href="/lists/list-1/design"';

test("a list without a purchased design gets a prominent promo above the gift tools", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain("Оформите список");
  expect(html).toContain("Выбрать оформление");
  expect(html).toContain(gotoDesign);
  expect(html.indexOf("owner-design-promo")).toBeGreaterThan(-1);
  expect(html.indexOf("owner-design-promo")).toBeLessThan(html.indexOf("owner-command-center"));
});

test("the design link is not buried in the settings section any more", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "journal", children: false, invitation: false, newYear: false, celebration: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html.split(gotoDesign)).toHaveLength(2);
  expect(html.slice(html.indexOf('class="owner-settings"'))).not.toContain(gotoDesign);
});

test("with a purchased design the card names the active theme and offers to change it", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "children-pink", children: true, invitation: false, newYear: false, celebration: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).not.toContain("Оформите список");
  expect(html).toContain("Розовое оформление");
  expect(html).toContain("Настроить оформление");
  expect(html).toContain(gotoDesign);
});

test("a bought design that is not applied yet asks the owner to pick a colour", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "journal", children: true, invitation: false, newYear: false, celebration: false });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain("Оформление куплено, но не применено");
});

test("celebration purchase is recognized in the owner promo without offering another purchase", async () => {
  vi.mocked(getDesignAccess).mockResolvedValue({ theme: "celebration", children: false, invitation: false, newYear: false, celebration: true });
  const html = renderToStaticMarkup(await OwnerListPage({ params: Promise.resolve({ id: "list-1" }) }));
  expect(html).toContain("Оформление «Праздник»");
  expect(html).not.toContain("Оформите список");
  expect(html).toContain("Настроить оформление");
});
