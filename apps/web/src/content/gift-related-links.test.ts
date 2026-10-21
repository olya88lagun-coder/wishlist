import { describe, expect, test } from "vitest";
import { relatedGiftLinks } from "./gift-related-links";

describe("relatedGiftLinks", () => {
  test("links a recipient page to the other recipient pages, not to itself", () => {
    const hrefs = relatedGiftLinks("for-brother").map((link) => link.href);

    expect(hrefs).toContain("/gifts/for-sister");
    expect(hrefs).toContain("/gifts/for-mom");
    expect(hrefs).not.toContain("/gifts/for-brother");
  });

  test("links an occasion page to the other occasions", () => {
    const hrefs = relatedGiftLinks("housewarming").map((link) => link.href);

    expect(hrefs).toContain("/gifts/march-8");
    expect(hrefs).toContain("/gifts/wedding");
    expect(hrefs).not.toContain("/gifts/housewarming");
  });

  test("adds the common occasions and budget once and never the page itself", () => {
    for (const slug of ["for-mom", "birthday", "under-5000", "books"]) {
      const hrefs = relatedGiftLinks(slug).map((link) => link.href);

      expect(new Set(hrefs).size, slug).toBe(hrefs.length);
      expect(hrefs, slug).not.toContain(`/gifts/${slug}`);
    }
    expect(relatedGiftLinks("for-brother").map((link) => link.href)).toEqual(expect.arrayContaining(["/gifts/birthday", "/gifts/new-year", "/gifts/under-5000"]));
  });

  test("returns only the common links for a page outside every group", () => {
    expect(relatedGiftLinks("unknown").map((link) => link.href)).toEqual(["/gifts/birthday", "/gifts/new-year", "/gifts/under-5000"]);
  });
});
