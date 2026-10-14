import { describe, expect, test } from "vitest";
import { ARTICLES } from "./articles";
import { CHILD_GIFT_COLLECTIONS } from "./children-gifts";

// Заголовок в выдаче обрезается примерно по 60-70 знакам вместе с хвостом " | MyWishList"
const TITLE_SUFFIX = " | MyWishList";
const MAX_TITLE_LENGTH = 70;

describe("search result titles", () => {
  test("article titles stay within the length that search engines show", () => {
    for (const article of ARTICLES) {
      expect([...article.title + TITLE_SUFFIX].length, article.slug).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
  });

  test("children page titles stay within the length that search engines show", () => {
    for (const collection of CHILD_GIFT_COLLECTIONS) {
      expect([...collection.title + TITLE_SUFFIX].length, collection.slug).toBeLessThanOrEqual(MAX_TITLE_LENGTH);
    }
  });
});
