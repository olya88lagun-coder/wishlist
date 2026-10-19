import { afterEach, expect, test, vi } from "vitest";
import sitemap from "./sitemap";
import { ARTICLES } from "@/content/articles";
import { GIFT_IDEAS } from "@/content/gift-ideas";

afterEach(() => vi.useRealTimers());

test("the sitemap lists the books gift page once", () => {
  const urls = sitemap().map((entry) => entry.url);
  expect(urls.filter((url) => url.endsWith("/gifts/books"))).toHaveLength(1);
});

test("the sitemap lists the sport gift page once", () => {
  const urls = sitemap().map((entry) => entry.url);
  expect(urls.filter((url) => url.endsWith("/gifts/sport"))).toHaveLength(1);
});

test("article sitemap dates match their content and the hub uses the latest update", () => {
  const entries = sitemap();
  for (const article of ARTICLES) {
    const entry = entries.find((item) => item.url.endsWith(`/articles/${article.slug}`));
    expect(new Date(entry!.lastModified!).toISOString().slice(0, 10)).toBe(article.updatedAt);
    expect(article.updatedAt >= article.publishedAt).toBe(true);
  }
  const latest = ARTICLES.map((article) => article.updatedAt).sort().at(-1)!;
  const hub = entries.find((item) => item.url.endsWith("/articles"));
  expect(new Date(hub!.lastModified!).toISOString().slice(0, 10)).toBe(latest);
});

test.each([
  ["/gifts", "2026-10-14"],
  ["/gifts/for-mom", "2026-10-19"],
  ["/gifts/under-3000", "2026-10-19"],
  ["/gifts/books", "2026-10-19"],
  ["/gifts/sport", "2026-10-19"],
  ["/gifts/for-children", "2026-10-08"],
  ["/gifts/for-child-3-years", "2026-10-08"],
])("%s uses its last substantive content change (%s)", (path, expectedDate) => {
  const entry = sitemap().find((item) => item.url.endsWith(path));
  expect(entry).toBeDefined();
  expect(new Date(entry!.lastModified!).toISOString().slice(0, 10)).toBe(expectedDate);
});

test("all ordinary collections include the shared price guidance updated on October 19", () => {
  const collections = sitemap().filter((entry) => entry.url.includes("/gifts/")
    && !entry.url.includes("/gifts/for-child"));
  for (const entry of collections) {
    const slug = entry.url.split("/").at(-1)!;
    expect(GIFT_IDEAS[slug]).toBeDefined();
    expect(new Date(entry.lastModified!).toISOString().slice(0, 10)).toBe("2026-10-19");
  }
});

test("sitemap content dates do not advance with the build or request date", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
  const first = sitemap();
  vi.setSystemTime(new Date("2027-02-01T10:00:00Z"));
  expect(sitemap()).toEqual(first);
});
