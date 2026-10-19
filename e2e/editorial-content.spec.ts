import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

const articleCollections = [
  ["kak-sostavit-vishlist", "/gifts"],
  ["chto-podarit-mame-na-den-rozhdeniya", "/gifts/for-mom"],
  ["idei-podarkov-na-den-rozhdeniya", "/gifts/birthday"],
  ["podarki-do-3000-rubley", "/gifts/under-3000"],
] as const;

test("each article leads to its matching collection and keeps wishlist creation", async ({ page }, testInfo) => {
  for (const [slug, href] of articleCollections) {
    await page.goto(`/articles/${slug}?analytics_test=1`);
    const selection = page.getByRole("region", { name: "Подборка по теме статьи" });
    const link = selection.getByRole("link");
    await expect(link).toHaveAttribute("href", href);
    await expect(page.getByRole("link", { name: "Создать вишлист", exact: true })).toHaveAttribute("href", "/lists");
    await link.scrollIntoViewIfNeeded();
    const bounds = await link.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (slug === "chto-podarit-mame-na-den-rozhdeniya") {
      await page.screenshot({ path: testInfo.outputPath("article-collection.png") });
    }
    await link.click();
    await expect(page).toHaveURL(href);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("the price explanation precedes the gift cards", async ({ page }, testInfo) => {
  await page.goto("/gifts/for-mom?analytics_test=1");
  const note = page.getByText("Цены — примерные диапазоны для планирования бюджета", { exact: false });
  await expect(note).toBeVisible();
  expect(await note.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector(".gift-idea")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await note.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("price-explanation.png") });
});
