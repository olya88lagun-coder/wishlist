import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

test("mobile menu supports keyboard dismissal, touch targets and section navigation at 320px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?analytics_test=1");
  const toggle = page.locator(".home-mobile-menu > summary");
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press("Enter");
  const nav = page.getByRole("navigation", { name: "Мобильные разделы сайта" });
  await expect(nav.getByRole("link", { name: "Войти", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Создать список", exact: true })).toHaveAttribute("href", "/login");
  await expect(nav.getByRole("link", { name: "Статьи", exact: true })).toHaveAttribute("href", "/articles");
  for (const link of await nav.getByRole("link").all()) {
    const bounds = await link.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath("mobile-menu.png") });
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Войти", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.locator(".hero").click({ position: { x: 2, y: 2 } });
  await expect(nav).toBeHidden();
  await toggle.click();
  await nav.getByRole("link", { name: "Подборки подарков", exact: true }).click();
  await expect(page).toHaveURL(/#collections-title$/);
  await expect(nav).toBeHidden();
  await expect(page.getByRole("heading", { name: "Подборки подарков", exact: true })).toBeInViewport();
});

test("mobile menu reflects the signed-in account and closes when the desktop navigation returns", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.request.get(`/api/dev/login?name=Navigation-${Date.now()}`);
  await page.goto("/");
  const toggle = page.locator(".home-mobile-menu > summary");
  await expect(toggle).toBeVisible();
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Мобильные разделы сайта" });
  await expect(nav.getByRole("link", { name: "Мои списки", exact: true })).toHaveAttribute("href", "/lists");
  await expect(nav.getByRole("link", { name: "Профиль", exact: true })).toHaveAttribute("href", "/me");
  await expect(nav.getByRole("link", { name: "Войти", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(toggle).toBeHidden();
  await expect(page.locator(".home-login")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeHidden();
  await toggle.click();
  await nav.getByRole("link", { name: "Статьи", exact: true }).click();
  await expect(page).toHaveURL(/\/articles$/);
});
