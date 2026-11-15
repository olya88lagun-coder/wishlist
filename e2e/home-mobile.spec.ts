import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

test.use({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce" });

test("mobile home fits two creation links and two wishlist preview cards above the fold", async ({ page }) => {
  await page.goto("/");

  const actions = page.locator(".hero .hero__actions a");
  const preview = page.locator(".home-preview");
  const cards = preview.locator(".card:visible");

  await expect(actions).toHaveCount(2);
  await expect(cards).toHaveCount(2);
  await expect(cards.getByText("Я подарю", { exact: true })).toBeVisible();
  await expect(cards.locator(".card__sticker").getByText("Забронировано", { exact: true }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Кнопки целиком в первом экране; у карточек должна быть видна хотя бы верхняя половина (убедиться, что превью не уехало вниз)
  for (const item of await actions.all()) {
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);
  }
  for (const card of await cards.all()) {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height / 2).toBeLessThanOrEqual(667);
  }
});
