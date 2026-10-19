import { expect, test } from "vitest";
import sitemap from "./sitemap";
import { ARTICLES } from "@/content/articles";

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
