import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import GiftsPage, { metadata } from "./page";

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
    const html = renderToStaticMarkup(await GiftsPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Как работает AI-подбор подарков");
    expect(html).toContain("Персональные идеи");
    expect(html).toContain("Подарок можно сохранить в вишлист");
    expect(html).toContain('href="/gifts/for-mom"');
    expect(html).toContain('href="/gifts/under-3000"');
  });

  test("puts the AI gift selection query into the title and the H1", async () => {
    const html = renderToStaticMarkup(await GiftsPage({ searchParams: Promise.resolve({}) }));

    expect(metadata.title).toContain("AI-подбор подарков");
    expect(html).toMatch(/<h1[^>]*>AI-подбор подарков:/);
  });

  test("publishes the visible FAQ as FAQPage data", async () => {
    const html = renderToStaticMarkup(await GiftsPage({ searchParams: Promise.resolve({}) }));
    const json = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]!;
    const faq = JSON.parse(json).find((item: { "@type": string }) => item["@type"] === "FAQPage");

    expect(faq.mainEntity.length).toBe(3);
    expect(html).toContain("Как работает AI-подбор подарков?");
  });

  test("prefills the interests passed from the home page without sending a request", async () => {
    const html = renderToStaticMarkup(await GiftsPage({ searchParams: Promise.resolve({ interests: "  брат, походы, кофе  " }) }));

    expect(html).toContain(">брат, походы, кофе</textarea>");
  });

  test("ignores a repeated interests parameter and caps the prefilled length", async () => {
    const repeated = renderToStaticMarkup(await GiftsPage({ searchParams: Promise.resolve({ interests: ["один", "два"] }) }));
    const long = renderToStaticMarkup(await GiftsPage({ searchParams: Promise.resolve({ interests: "а".repeat(500) }) }));

    expect(repeated).not.toContain(">один");
    expect(long).toContain(`>${"а".repeat(200)}</textarea>`);
    expect(long).not.toContain("а".repeat(201));
  });
});
