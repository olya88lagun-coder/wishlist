import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

test.use({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce" });

test("mobile home fits two creation links and two wishlist preview cards above the fold", async ({ page }) => {
  await page.goto("/");

  const actions = page.locator(".hero__actions a");
  const preview = page.locator(".home-preview");
  const cards = preview.locator(".card:visible");

  await expect(actions).toHaveCount(2);
  await expect(cards).toHaveCount(2);
  await expect(preview.getByText("Я подарю", { exact: true })).toBeVisible();
  await expect(preview.getByText("Забронировано", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const item of [...await actions.all(), ...await cards.all()]) {
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  }
});
