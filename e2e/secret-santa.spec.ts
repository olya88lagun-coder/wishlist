import { expect, test, type Browser, type Page } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  await blockMetrika(context);
  return context.newPage();
}

async function joinAndAddGift(browser: Browser, joinLink: string, name: string, gift: string) {
  const page = await newPage(browser);
  await page.goto(joinLink);
  await page.getByLabel("Ваше имя").fill(name);
  await page.getByRole("button", { name: "Вступить в игру" }).click();
  const personalLink = await page.getByLabel("Ваша личная ссылка").inputValue();
  await page.getByRole("link", { name: "Перейти к игре" }).click();
  await page.getByRole("link", { name: "Мой список желаний" }).click();
  const manual = page.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
  await manual.getByText("Добавить вручную или заполнить все поля").click();
  await manual.getByLabel("Что подарить").fill(gift);
  await manual.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("heading", { name: gift })).toBeVisible();
  return { page, personalLink };
}

test("organizer creates a game, guests join without login, the draw shows each Santa a recipient", async ({ browser }) => {
  const organizer = await newPage(browser);
  organizer.on("dialog", (dialog) => dialog.accept());
  await organizer.goto(`/api/dev/login?name=Santa-${Date.now()}`);
  await organizer.goto("/santa/new");
  await organizer.getByLabel("Название игры").fill("Отдел маркетинга");
  await organizer.getByLabel("Бюджет").fill("до 1 500 ₽");
  await organizer.getByLabel("Дата обмена").fill("2026-12-25");
  await organizer.getByLabel("Ваше имя в игре").fill("Оля");
  await organizer.getByRole("button", { name: "Создать игру" }).click();
  await expect(organizer).toHaveURL(/\/santa\/[0-9a-f-]{36}$/);
  const gameUrl = organizer.url();
  const joinLink = await organizer.getByLabel("Ссылка для участников").inputValue();

  const petya = await joinAndAddGift(browser, joinLink, "Петя", "Тёплые носки");
  const anya = await joinAndAddGift(browser, joinLink, "Аня", "Книга");

  await organizer.reload();
  await expect(organizer.getByRole("listitem").filter({ hasText: "Петя" })).toBeVisible();
  await organizer.getByRole("button", { name: "Провести жеребьёвку" }).click();
  await expect(organizer.getByText("Вы дарите:")).toBeVisible();
  await expect(organizer.getByText("Вы дарите:")).toHaveCount(1);

  for (const guest of [petya, anya]) {
    await guest.page.goto(gameUrl);
    await expect(guest.page.getByText("Вы дарите:")).toBeVisible();
    await guest.page.getByRole("link", { name: "Открыть список получателя" }).click();
    await expect(guest.page.getByRole("heading", { level: 1 })).toContainText("Тайный Санта: Отдел маркетинга");
  }

  const elsewhere = await newPage(browser);
  await elsewhere.goto(petya.personalLink);
  await expect(elsewhere).toHaveURL(gameUrl);
  await expect(elsewhere.getByText("Вы дарите:")).toBeVisible();
});

test("an unknown personal link is not found", async ({ page }) => {
  await blockMetrika(page.context());
  const response = await page.goto("/santa/me/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  expect(response?.status()).toBe(404);
});

test("a guest opening game creation is sent to login and comes back to it", async ({ page }) => {
  await blockMetrika(page.context());
  await page.goto("/santa/new");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fsanta%2Fnew$/);
});
