import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import * as content from "@/content/articles";
import ArticlePage, { generateMetadata } from "./page";

afterEach(() => vi.restoreAllMocks());

test.each([
  ["2027-01-02", "2 января 2027 г."],
  ["2028-12-31", "31 декабря 2028 г."],
])("article UI, metadata and structured data use updatedAt %s", async (updatedAt, formattedDate) => {
  const article = { ...content.ARTICLES[0], updatedAt };
  vi.spyOn(content, "getArticle").mockReturnValue(article);
  const params = Promise.resolve({ slug: article.slug });
  const html = renderToStaticMarkup(await ArticlePage({ params })).replace(/\u00a0/g, " ");
  expect(html).toMatch(new RegExp(`<time datetime="${updatedAt}">${formattedDate}</time>`, "i"));
  expect(html).toContain(`"dateModified":"${updatedAt}"`);
  const metadata = await generateMetadata({ params });
  expect(metadata.openGraph).toMatchObject({ modifiedTime: updatedAt });
});

test.each(content.ARTICLES)("related links for $slug point to existing, distinct articles", (article) => {
  const slugs = content.RELATED_ARTICLE_SLUGS[article.slug];
  expect(slugs.length).toBeGreaterThanOrEqual(2);
  expect(slugs.length).toBeLessThanOrEqual(3);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const slug of slugs) {
    expect(slug).not.toBe(article.slug);
    expect(content.getArticle(slug)).toBeDefined();
  }
  expect(content.getRelatedArticles(article.slug).map((item) => item.slug)).toEqual(slugs);
});

test("budget article starts related reading with birthday and recipient advice", async () => {
  const html = renderToStaticMarkup(await ArticlePage({
    params: Promise.resolve({ slug: "podarki-do-3000-rubley" }),
  }));
  const relatedSection = html.slice(html.indexOf('<section class="related-articles"'));
  const links = [...relatedSection.matchAll(/href="\/articles\/([^"]+)"/g)].map((match) => match[1]);
  expect(links).toEqual([
    "idei-podarkov-na-den-rozhdeniya",
    "chto-podarit-mame-na-den-rozhdeniya",
    "kak-sostavit-vishlist",
  ]);
});

test("wishlist guide recommends gift-selection topics without filling every available slot", async () => {
  const html = renderToStaticMarkup(await ArticlePage({
    params: Promise.resolve({ slug: "kak-sostavit-vishlist" }),
  }));
  const relatedSection = html.slice(html.indexOf('<section class="related-articles"'));
  expect(relatedSection).toContain('/articles/idei-podarkov-na-den-rozhdeniya');
  expect(relatedSection).toContain('/articles/podarki-do-3000-rubley');
  expect(relatedSection).not.toContain('/articles/chto-podarit-mame-na-den-rozhdeniya');
});

test("unknown articles have no related links", () => {
  expect(content.getRelatedArticles("missing-article")).toEqual([]);
});
