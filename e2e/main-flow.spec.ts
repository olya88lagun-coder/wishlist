import { expect, test } from "@playwright/test";

test("owner shares a list, a guest reserves and cancels, the owner never sees who", async ({ browser }) => {
  const stamp = Date.now().toString(36);
  const listTitle = `E2E список ${stamp}`;
  const giftTitle = `Свеча ${stamp}`;

  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await ownerPage.goto(`/api/dev/login?name=E2E-${stamp}`);
  await expect(ownerPage).toHaveURL(/\/lists$/);

  // У нового пользователя форма уже раскрыта; клик по заголовку её бы свернул
  if (!(await ownerPage.getByLabel("Название").isVisible())) await ownerPage.getByText("Новый список").click();
  await ownerPage.getByLabel("Название").fill(listTitle);
  await ownerPage.getByRole("button", { name: "Создать список" }).click();
  // После создания приложение сразу открывает страницу списка
  await expect(ownerPage.getByRole("heading", { level: 1 })).toHaveText(listTitle);

  const fullForm = ownerPage.locator("details").filter({ hasText: "Добавить без ссылки или со всеми полями" });
  await fullForm.getByText("Добавить без ссылки или со всеми полями").click();
  await fullForm.getByLabel("Что подарить").fill(giftTitle);
  await fullForm.getByLabel("Цена, ₽").fill("990");
  await fullForm.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(ownerPage.getByRole("heading", { name: giftTitle })).toBeVisible();

  const publicHref = await ownerPage.getByRole("link", { name: "Как видят гости" }).getAttribute("href");
  expect(publicHref).toMatch(/^\/[A-Za-z0-9]{10}$/);

  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(publicHref!);
  await expect(guestPage.getByRole("heading", { name: giftTitle })).toBeVisible();
  // Список открыт по ссылке, но не должен попадать в поиск
  await expect(guestPage.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await guestPage.getByRole("button", { name: "Я подарю" }).first().click();
  await guestPage.getByLabel("Как вас подписать").fill("Тайный гость");
  await guestPage.getByRole("dialog").getByRole("button", { name: "Я подарю" }).click();
  await expect(guestPage.getByText("вы дарите")).toBeVisible();

  await ownerPage.reload();
  await expect(ownerPage.getByText("забронировано")).toBeVisible();
  await expect(ownerPage.getByText("Тайный гость")).toHaveCount(0);

  guestPage.once("dialog", (dialog) => void dialog.accept());
  await guestPage.getByRole("button", { name: "Снять бронь" }).click();
  await expect(guestPage.getByRole("button", { name: "Я подарю" }).first()).toBeVisible();

  await owner.close();
  await guest.close();
});
