import { expect, test, type Browser, type Page } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

const giftTitle = "Подарок для уютного вечера с большой компанией друзей и долгими разговорами за чаем";

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
