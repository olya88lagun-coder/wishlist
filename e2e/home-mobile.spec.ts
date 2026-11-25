import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

test.use({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce" });

test("mobile home shows brand and one primary CTA above the fold, preview below", async ({ page }) => {
  await page.goto("/");

  const brand = page.locator(".hero .hero__brand-name");
  const primary = page.locator(".hero .hero__actions .hero-button");
  const secondary = page.locator(".hero .hero__text-link");
  const preview = page.locator(".home-demo .home-preview");

  await expect(brand).toHaveText("MyWishList");
  await expect(primary).toHaveCount(1);
  await expect(primary).toContainText("Собрать в Telegram");
  await expect(secondary).toContainText("Собрать на сайте");
  await expect(preview).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  for (const item of [brand, primary]) {
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  }

  const previewBox = await preview.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(previewBox!.y).toBeGreaterThan(500);
});
