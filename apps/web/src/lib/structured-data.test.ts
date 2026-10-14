import { describe, expect, test } from "vitest";
import { ARTICLES } from "@/content/articles";
import { articlesHubJsonLd, giftsHubJsonLd } from "./structured-data";

const BASE = "https://my-wish-list.online";

describe("structured data for hub pages", () => {
  test("gifts hub is a web page with breadcrumbs", () => {
    const [page, crumbs] = giftsHubJsonLd(BASE);

    expect(page).toMatchObject({ "@type": "WebPage", url: `${BASE}/gifts` });
    expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" });
    expect(crumbs.itemListElement.map((item) => item.item)).toEqual([BASE, `${BASE}/gifts`]);
  });

  test("articles hub lists every article in order with absolute urls", () => {
    const [collection, crumbs] = articlesHubJsonLd(BASE);

    expect(collection).toMatchObject({ "@type": "CollectionPage", url: `${BASE}/articles` });
    expect(collection.mainEntity.itemListElement.map((item) => item.url)).toEqual(
      ARTICLES.map((article) => `${BASE}/articles/${article.slug}`),
    );
    expect(collection.mainEntity.itemListElement.map((item) => item.position)).toEqual(ARTICLES.map((_, index) => index + 1));
    expect(crumbs.itemListElement.at(-1)?.item).toBe(`${BASE}/articles`);
  });
});
