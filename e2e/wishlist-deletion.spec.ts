import { expect, test } from "@playwright/test";
import { blockMetrika } from "./analytics-counter";

test("deleting a list with a connected giver keeps confirmation and removes its public page", async ({ browser }) => {
  const owner = await browser.newContext();
  const guest = await browser.newContext();
  await blockMetrika(owner); await blockMetrika(guest);
  try {
    const ownerPage = await owner.newPage();
    const guestPage = await guest.newPage();
    const stamp = Date.now();
    await ownerPage.goto(`/api/dev/login?name=Delete-owner-${stamp}`);
    await expect(ownerPage).toHaveURL(/\/lists$/);
    await ownerPage.getByLabel("Название", { exact: true }).fill("Тест удаления с бронью");
    await ownerPage.getByRole("button", { name: "Создать список", exact: true }).click();
    const manual = ownerPage.locator("details").filter({ hasText: "Добавить вручную или заполнить все поля" });
    await manual.getByText("Добавить вручную или заполнить все поля").click();
    await manual.getByLabel("Что подарить").fill("Подарок для удаления");
    await manual.getByRole("button", { name: "Добавить", exact: true }).click();
    await expect(ownerPage.getByRole("heading", { name: "Подарок для удаления" })).toBeVisible();
    const publicHref = await ownerPage.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
    await guestPage.goto(`/api/dev/login?name=Delete-guest-${stamp}`);
    await expect(guestPage).toHaveURL(/\/lists$/);
    await guestPage.goto(`${publicHref!}?analytics_test=1`);
    await guestPage.getByRole("button", { name: "Я подарю", exact: true }).click();
    await guestPage.getByLabel("Как вас подписать").fill("Тестовый даритель");
    await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю", exact: true }).click();
    await expect(guestPage.getByText("вы дарите", { exact: true })).toBeVisible();

    await ownerPage.reload();
    await expect(ownerPage.getByText("забронировано", { exact: true })).toBeVisible();
    await expect(ownerPage.getByText("Тестовый даритель", { exact: true })).toHaveCount(0);
    await ownerPage.getByText("Настройки списка", { exact: false }).click();
    ownerPage.once("dialog", (dialog) => void dialog.dismiss());
    await ownerPage.getByRole("button", { name: "Удалить список", exact: true }).click();
    await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText("Тест удаления с бронью");
    ownerPage.once("dialog", (dialog) => void dialog.accept());
    await ownerPage.getByRole("button", { name: "Удалить список", exact: true }).click();
    await expect(ownerPage).toHaveURL(/\/lists$/);
    await expect(ownerPage.getByRole("link", { name: /Тест удаления с бронью/ })).toHaveCount(0);
    const response = await guestPage.reload();
    expect(response?.status()).toBe(404);
  } finally { await owner.close(); await guest.close(); }
});
