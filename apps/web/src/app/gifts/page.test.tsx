import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import GiftsPage from "./page";

vi.mock("@wishlist/db", () => ({
  listWishlistsForOwner: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/server/viewer", () => ({
  readViewer: vi.fn(),
}));

const { readViewer } = await import("@/server/viewer");

describe("GiftsPage", () => {
  beforeEach(() => {
    vi.mocked(readViewer).mockResolvedValue({ user: null, viewer: { userId: null, guestToken: null } });
  });

  test("explains AI gift selection with premium SEO sections and internal links", async () => {
    const html = renderToStaticMarkup(await GiftsPage());

    expect(html).toContain("Как работает AI-подбор подарков");
    expect(html).toContain("Персональные идеи");
    expect(html).toContain("Подарок можно сохранить в вишлист");
    expect(html).toContain('href="/gifts/for-mom"');
    expect(html).toContain('href="/gifts/under-3000"');
  });
});
