import { expect, test, type Page } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

async function createList(page: Page, title = "Проверка форм и подписей") {
  await page.goto(`/api/dev/login?name=Forms-${Date.now()}`);
  await expect(page).toHaveURL(/\/lists$/);
  await page.getByLabel("Название", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
}

async function addGift(page: Page, title = "Подарок для проверки", note = "Тестовая заметка") {
  const manual = page.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
  await manual.getByText("Добавить вручную или заполнить все поля").click();
  await manual.getByLabel("Что подарить").fill(title);
  await manual.getByLabel("Заметка").fill(note);
  await manual.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
}

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const values = color.startsWith("#")
      ? color.slice(1).match(/../g)!.map((value) => parseInt(value, 16))
      : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const rgb = values.map((value) => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return .2126 * rgb[0]! + .7152 * rgb[1]! + .0722 * rgb[2]!;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

for (const theme of ["light", "dark"] as const) {
  test(`small owner labels, public notes and reservation badges remain readable in ${theme} mode`, async ({ page, browser }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await createList(page);
    await addGift(page);
    const ownerColors = await page.evaluate(() => {
      const meta = document.querySelector<HTMLElement>(".card__meta")!;
      const input = document.querySelector<HTMLInputElement>("#quick-url")!;
      return {
        note: getComputedStyle(meta).color,
        input: getComputedStyle(input).color,
        placeholder: getComputedStyle(input, "::placeholder").color,
      };
    });
    // Нижний край кремового градиента темнее карточек и даёт консервативную проверку.
    for (const [label, color] of Object.entries(ownerColors)) expect.soft(contrast(color, "#eee1d1"), `owner ${theme}: ${label}`).toBeGreaterThanOrEqual(4.5);
    const publicHref = await page.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
    const guest = await browser.newContext({ colorScheme: theme, viewport: page.viewportSize()! });
    await blockMetrika(guest);
    try {
      const guestPage = await guest.newPage();
      await guestPage.goto(`${publicHref!}?analytics_test=1`);
      await guestPage.getByRole("button", { name: "Я подарю", exact: true }).click();
      await guestPage.getByLabel("Как вас подписать").fill("Проверка");
      await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
      await expect(guestPage.getByText("вы дарите", { exact: true })).toBeVisible();
      const colors = await guestPage.evaluate(() => {
        const meta = document.querySelector(".card__meta")!;
        const sticker = document.querySelector(".sticker--reserved")!;
        return {
          meta: getComputedStyle(meta).color,
          paper: getComputedStyle(document.body).backgroundColor,
          stickerText: getComputedStyle(sticker).color,
          stickerBackground: getComputedStyle(sticker).backgroundColor,
        };
      });
      expect.soft(contrast(colors.meta, colors.paper), `public ${theme}: note`).toBeGreaterThanOrEqual(4.5);
      expect.soft(contrast(colors.stickerText, colors.stickerBackground), `public ${theme}: badge`).toBeGreaterThanOrEqual(4.5);
      await guestPage.screenshot({ path: testInfo.outputPath(`readable-public-${theme}.png`) });
      await page.screenshot({ path: testInfo.outputPath(`readable-owner-${theme}.png`) });
    } finally { await guest.close(); }
  });
}
