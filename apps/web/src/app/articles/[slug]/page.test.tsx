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
