import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/server/viewer", () => ({ readViewer: vi.fn().mockResolvedValue({ user: null }) }));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@wishlist/db", () => ({ listWishlistsForOwner: vi.fn() }));

import GiftPage, { generateMetadata } from "./page";
import sitemap from "../../sitemap";

const slugs = ["for-children", "for-child-under-1", "for-child-1-year", ...[2, 3, 4, 5, 6, 7].map(age => `for-child-${age}-years`)];

test("child collections are reachable, have unique metadata and appear in sitemap", async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const slug of slugs) {
    const params = Promise.resolve({ slug });
    const metadata = await generateMetadata({ params });
    expect(metadata.alternates?.canonical).toBe(`/gifts/${slug}`);
    expect(metadata.description).toBeTruthy();
    titles.add(metadata.title);
    descriptions.add(metadata.description);
    const html = renderToStaticMarkup(await GiftPage({ params }));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('href="/lists"');
    expect(sitemap().some(item => item.url.endsWith(`/gifts/${slug}`))).toBe(true);
  }
  expect(titles.size).toBe(9);
  expect(descriptions.size).toBe(9);
});

test("retains ambiguous offers and states the exact edition uncertainty", async () => {
  for (const slug of ["for-child-1-year", "for-child-2-years"]) {
    const html = renderToStaticMarkup(await GiftPage({ params: Promise.resolve({ slug }) }));
    expect(html).toContain("Хочу к маме");
    expect(html).toContain("Возраст точного издания не подтверждён");
    expect(html).toContain("У сходного издания: 3+");
    expect(html).toContain('rel="sponsored nofollow noopener noreferrer"');
    expect(html).toContain("erid Y1jgkD6uB6jK1phqkTLTbNKYUwF4");
    expect(html).toContain("product%2F3031728138");
  }
});

test("under-one page separates birth, three months and ten months instead of claiming all are 0+", async () => {
  const html = renderToStaticMarkup(await GiftPage({ params: Promise.resolve({ slug: "for-child-under-1" }) }));
  expect(html).toContain("С 10 месяцев");
  expect(html).toContain("от 3 месяцев");
  expect(html).toContain("В каталоге: от 0");
  expect(html).toContain("Цена и наличие");
  expect(html).not.toContain("800 ₽");
});

test("children hub links to every age collection", async () => {
  const html = renderToStaticMarkup(await GiftPage({ params: Promise.resolve({ slug: "for-children" }) }));
  for (const slug of slugs.slice(1)) expect(html).toContain(`href="/gifts/${slug}"`);
});
