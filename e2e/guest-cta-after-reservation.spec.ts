import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

const gifts = ["Плед", "Кружка", "Книга", "Настольная игра", "Свеча", "Термос"];

test.beforeEach(async ({ context }) => { await blockMetrika(context); });

test("after reserving a gift low on the page the guest sees the own-wishlist invitation", async ({ browser, page }) => {
  const owner = await browser.newContext();
  await blockMetrika(owner);
  let publicHref: string | null;
  try {
    const ownerPage = await owner.newPage();
    await ownerPage.goto(`/api/dev/login?name=Cta-${Date.now()}`);
    await expect(ownerPage).toHaveURL(/\/lists$/);
    await ownerPage.getByLabel("Название", { exact: true }).fill("Проверка приглашения гостя");
    await ownerPage.getByRole("button", { name: "Создать список", exact: true }).click();
    const manual = ownerPage.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
    for (const gift of gifts) {
      if (!(await manual.getByLabel("Что подарить").isVisible())) await manual.getByText("Добавить вручную или заполнить все поля").click();
      await manual.getByLabel("Что подарить").fill(gift);
      await manual.getByRole("button", { name: "Добавить", exact: true }).click();
      await expect(ownerPage.getByRole("heading", { name: gift, exact: true })).toBeVisible();
    }
    publicHref = await ownerPage.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  } finally {
    await owner.close();
  }

  await page.goto(publicHref!);
  await page.getByRole("button", { name: "Я подарю", exact: true }).last().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Как вас подписать").fill("Гость");
  await dialog.getByRole("button", { name: "Я подарю", exact: true }).click();
  await expect(dialog).toBeHidden();

  const invitation = page.getByRole("heading", { name: "Подарок выбран. А что хотите вы?" });
  await expect(invitation).toBeFocused();
  await expect(invitation).toBeInViewport();
});
