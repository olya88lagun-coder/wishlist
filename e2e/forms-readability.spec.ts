import { expect, test, type Locator, type Page } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test.beforeEach(async ({ context }) => blockMetrika(context));

async function createList(page: Page, title = "Проверка форм и подписей") {
  await page.goto(`/api/dev/login?name=Forms-${Date.now()}`);
  await expect(page).toHaveURL(/\/lists$/);
  await page.getByLabel("Название", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Создать список", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
}

async function expectFieldError(page: Page, field: Locator, message: string) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const errorId = await field.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText(message);
}

async function expectNoOverflow(page: Page, selectors: string[], surface: string) {
  const widths = await page.evaluate((targets) => ({
    page: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    nodes: targets.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector), (node) => ({
      selector, scroll: node.scrollWidth, width: node.clientWidth,
    }))),
  }), selectors);
  expect.soft(widths.page, `${surface}: page width`).toBeLessThanOrEqual(widths.viewport + 1);
  for (const node of widths.nodes) expect.soft(node.scroll, `${surface}: ${node.selector}`).toBeLessThanOrEqual(node.width + 1);
}

test("maximum unbroken titles and notes stay within owner, overview and public layouts", async ({ page, browser }, testInfo) => {
  if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 320, height: 568 });
  const title = "Д".repeat(80);
  const gift = "Ж".repeat(200);
  const note = "З".repeat(300);
  await createList(page, title);
  await addGift(page, gift, note);
  await expectNoOverflow(page, [".owner-hero__title", ".card__title", ".card__meta"], "owner");
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("long-owner-title.png") });
  const publicHref = await page.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expectNoOverflow(page, [".owner-list-card h2"], "overview");
  const guest = await browser.newContext({ viewport: page.viewportSize()! });
  await blockMetrika(guest);
  try {
    const guestPage = await guest.newPage();
    await guestPage.goto(`${publicHref!}?analytics_test=1`);
    await expect(guestPage.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(guestPage.locator(".card__title")).toHaveText(gift);
    await expect(guestPage.locator(".card__meta")).toHaveText(note);
    await expectNoOverflow(guestPage, [".display", ".card__title", ".card__meta"], "public");
    await guestPage.screenshot({ path: testInfo.outputPath("long-public-title.png") });
  } finally { await guest.close(); }
});

test("invalid list creation focuses its field on each attempt and preserves the occasion and date", async ({ page }, testInfo) => {
  await page.goto(`/api/dev/login?name=Create-errors-${Date.now()}`);
  const title = page.getByLabel("Название", { exact: true });
  await page.getByLabel("Повод", { exact: true }).selectOption("new_year");
  await page.getByLabel("Дата праздника", { exact: true }).fill("2026-12-31");
  const submit = page.getByRole("button", { name: "Создать список", exact: true });
  await submit.click();
  await expectFieldError(page, title, "Введите название списка");
  await expect(title).toBeFocused();
  await expect(page.getByLabel("Повод", { exact: true })).toHaveValue("new_year");
  await page.getByLabel("Повод", { exact: true }).focus();
  await submit.click();
  await expect(title).toBeFocused();
  await expect(page.getByLabel("Повод", { exact: true })).toHaveValue("new_year");
  await expect(page.getByLabel("Дата праздника", { exact: true })).toHaveValue("2026-12-31");
  await page.screenshot({ path: testInfo.outputPath("create-list-error.png") });
  await title.fill("Новогодние желания");
  await submit.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Новогодние желания");
});

test("quick and manual gift entry explain field errors, retain values and recover", async ({ page }, testInfo) => {
  await createList(page);
  const quick = page.locator("form.quick-link");
  const quickUrl = quick.getByLabel("Вставьте ссылку на подарок");
  await quick.getByRole("button", { name: "Добавить", exact: true }).click();
  await expectFieldError(page, quickUrl, "Вставьте ссылку или напишите название");
  await expect(quickUrl).toBeFocused();
  const manual = page.locator("details.owner-manual-add");
  await manual.getByText("Добавить вручную или заполнить все поля").click();
  const url = manual.getByLabel("Ссылка на товар");
  const price = manual.getByLabel("Цена, ₽");
  await url.fill("не ссылка");
  await manual.getByLabel("Что подарить").fill("Книга для вечера");
  await price.fill("не число");
  await manual.getByLabel("Заметка").fill("Сохранить эту заметку");
  const submit = manual.getByRole("button", { name: "Добавить", exact: true });
  await submit.click();
  await expectFieldError(page, url, "Ссылка должна начинаться с https://");
  await expectFieldError(page, price, "Цена — число в рублях, например 2 490");
  await expect(url).toBeFocused();
  await price.focus();
  await submit.click();
  await expect(url).toBeFocused();
  await expect(price).toHaveValue("не число");
  await expect(manual.getByLabel("Заметка")).toHaveValue("Сохранить эту заметку");
  await page.screenshot({ path: testInfo.outputPath("manual-gift-errors.png") });
  await url.fill("");
  await price.fill("2490");
  await submit.click();
  await expect(page.getByRole("heading", { name: "Книга для вечера", exact: true })).toBeVisible();
  await expect(url).not.toHaveAttribute("aria-invalid", "true");
  await expect(price).not.toHaveAttribute("aria-invalid", "true");
});

test("gift and list editors associate errors with their own fields and remain usable", async ({ page }) => {
  await createList(page);
  await addGift(page);
  const card = page.locator("article.card").first();
  const editor = card.locator("details");
  await editor.getByText("Изменить", { exact: true }).click();
  const title = editor.getByLabel("Что подарить");
  await title.fill("");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expectFieldError(page, title, "Вставьте ссылку или напишите название");
  await expect(title).toBeFocused();
  await title.fill("Исправленный подарок");
  await editor.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(card.getByRole("heading", { name: "Исправленный подарок", exact: true })).toBeVisible();
  const settings = page.locator("details.owner-settings-card");
  await settings.getByText("Настройки списка", { exact: false }).click();
  const listTitle = settings.getByLabel("Название", { exact: true });
  await listTitle.fill("");
  await settings.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expectFieldError(page, listTitle, "Введите название списка");
  await expect(listTitle).toBeFocused();
  await listTitle.fill("Исправленный список");
  await settings.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Исправленный список");
});

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
