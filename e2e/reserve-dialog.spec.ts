import { expect, test, type Browser, type Page } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

const giftTitle = "Подарок для уютного вечера с большой компанией друзей и долгими разговорами за чаем";

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).map(Number).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const light = luminance(foreground);
  const dark = luminance(background);
  return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
}

async function openGuestList(browser: Browser, page: Page) {
  const owner = await browser.newContext();
  await blockMetrika(owner);
  try {
    const ownerPage = await owner.newPage();
    await ownerPage.goto(`/api/dev/login?name=Dialog-${Date.now()}`);
    await expect(ownerPage).toHaveURL(/\/lists$/);
    await ownerPage.getByLabel("Название", { exact: true }).fill("Проверка окна бронирования");
    await ownerPage.getByRole("button", { name: "Создать список", exact: true }).click();
    const manual = ownerPage.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
    await manual.getByText("Добавить вручную или заполнить все поля").click();
    await manual.getByLabel("Что подарить").fill(giftTitle);
    await manual.getByLabel("Цена, ₽").fill("990");
    await manual.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(ownerPage.getByRole("heading", { name: giftTitle })).toBeVisible();
    const publicHref = await ownerPage.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
    await page.goto(`${publicHref!}?analytics_test=1`);
    await expect(page.getByRole("heading", { name: giftTitle })).toBeVisible();
  } finally {
    await owner.close();
  }
}

test.beforeEach(async ({ context }) => { await blockMetrika(context); });

test("reservation traps keyboard focus and restores its trigger after every dismissal", async ({ browser, page }) => {
  await openGuestList(browser, page);
  const trigger = page.getByRole("button", { name: "Я подарю", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: giftTitle });
  const name = dialog.getByLabel("Как вас подписать");
  const close = dialog.getByRole("button", { name: "Закрыть", exact: true });
  const submit = dialog.getByRole("button", { name: "Я подарю", exact: true });
  await expect(name).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(name).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("link", { name: "политике конфиденциальности" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  const background = page.getByRole("button", { name: "Скопировать ссылку", exact: true, includeHidden: true });
  await background.evaluate((button: HTMLButtonElement) => button.focus());
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.mouse.click(4, 4);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(background).toBeEnabled();
});

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }]) {
  test(`reservation stays reachable at ${viewport.width}×${viewport.height}`, async ({ browser, page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openGuestList(browser, page);
    const trigger = page.getByRole("button", { name: "Я подарю", exact: true });
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: giftTitle });
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    const close = dialog.getByRole("button", { name: "Закрыть", exact: true });
    const closeBounds = (await close.boundingBox())!;
    expect(closeBounds.width).toBeGreaterThanOrEqual(44);
    expect(closeBounds.height).toBeGreaterThanOrEqual(44);
    await dialog.getByLabel("Как вас подписать").fill("Гость");
    const submit = dialog.getByRole("button", { name: "Я подарю", exact: true });
    await submit.scrollIntoViewIfNeeded();
    const submitBounds = (await submit.boundingBox())!;
    expect(submitBounds.y).toBeGreaterThanOrEqual(0);
    expect(submitBounds.y + submitBounds.height).toBeLessThanOrEqual(viewport.height);
    expect(submitBounds.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`reserve-${viewport.width}x${viewport.height}.png`) });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}

test("successful reservation releases the modal and page scroll when its trigger unmounts", async ({ browser, page }) => {
  await openGuestList(browser, page);
  const originalOverflow = await page.evaluate(() => document.body.style.overflow);
  await page.getByRole("button", { name: "Я подарю", exact: true }).click();
  await page.getByLabel("Как вас подписать").fill("Тестовый гость");
  await page.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
  const cancel = page.getByRole("button", { name: "Снять бронь", exact: true });
  await expect(cancel).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(originalOverflow);
  await cancel.focus();
  await expect(cancel).toBeFocused();
});

test("invalid reservation name is described by its error and receives focus on every failed attempt", async ({ browser, page }, testInfo) => {
  await openGuestList(browser, page);
  await page.getByRole("button", { name: "Я подарю", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: giftTitle });
  const name = dialog.getByLabel("Как вас подписать");
  await name.fill("   ");
  const submit = dialog.getByRole("button", { name: "Я подарю", exact: true });
  await submit.click();
  const error = dialog.getByText("Напишите имя — до 40 символов", { exact: true });
  await expect(error).toBeVisible();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  const descriptionId = await name.getAttribute("aria-describedby");
  expect(descriptionId).toBeTruthy();
  await expect(error).toHaveAttribute("id", descriptionId!);
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("   ");
  await page.screenshot({ path: testInfo.outputPath("reservation-name-error.png") });

  await submit.click();
  await expect(name).toBeFocused();
  await name.fill("Гость после ошибки");
  await submit.click();
  await expect(page.getByRole("button", { name: "Снять бронь", exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
});

for (const colorScheme of ["light", "dark"] as const) test(`reservation guidance and validation remain readable in ${colorScheme} mode on a narrow screen`, async ({ browser, page }, testInfo) => {
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize({ width: 320, height: 568 });
  await openGuestList(browser, page);
  await page.getByRole("button", { name: "Я подарю", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: giftTitle });
  const name = dialog.getByLabel("Как вас подписать");
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await expect(name).not.toHaveAttribute("aria-describedby", /.+/);
  await dialog.getByRole("button", { name: "Я подарю", exact: true }).click();
  await expect(dialog.getByText("Напишите имя — до 40 символов", { exact: true })).toBeVisible();
  const background = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor);
  const textStyles = await dialog.locator("label, .muted, .error").evaluateAll((elements) =>
    elements.map((element) => ({ size: Number.parseFloat(getComputedStyle(element).fontSize), color: getComputedStyle(element).color })));
  expect(textStyles.length).toBeGreaterThanOrEqual(4);
  for (const text of textStyles) {
    expect(text.size).toBeGreaterThanOrEqual(14);
    expect(contrastRatio(text.color, background)).toBeGreaterThanOrEqual(4.5);
  }
  await page.screenshot({ path: testInfo.outputPath(`reservation-readable-${colorScheme}.png`) });
});
