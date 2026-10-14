import { expect, test } from "vitest";
import sitemap from "./sitemap";

test("the sitemap lists the books gift page once", () => {
  const urls = sitemap().map((entry) => entry.url);
  expect(urls.filter((url) => url.endsWith("/gifts/books"))).toHaveLength(1);
});
